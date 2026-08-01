import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  authorizeVoiceRetentionRequest,
  deleteTwilioRecording,
  executeVoiceRetention,
  isVoiceRetentionDryRun,
  isVoiceRetentionEnabled,
  voiceRetentionBatchLimit,
  voiceRetentionConfigurationError,
} from "../src/lib/voiceRetention.ts";

const ORIGINAL_ENV = { ...process.env };
const ACCOUNT_SID = `AC${"a".repeat(32)}`;
const API_KEY_SID = `SK${"b".repeat(32)}`;
const CALL_SID = `CA${"c".repeat(32)}`;
const RECORDING_SID = `RE${"d".repeat(32)}`;
const CRON_SECRET = "retention-test-secret-that-is-at-least-32-bytes";

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.WILDWORKS_VOICE_RETENTION_ENABLED;
  delete process.env.WILDWORKS_VOICE_RETENTION_DRY_RUN;
  delete process.env.WILDWORKS_VOICE_RETENTION_ALLOW_ACCOUNT_AUTH;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SID;
  delete process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SECRET;
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
}

function authorizedRequest(path = "https://wildworks.example/api/internal/voice-retention") {
  return new Request(path, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
}

test("retention authorization accepts only Vercel CRON_SECRET bearer auth", { concurrency: false }, () => {
  resetEnv();
  assert.equal(authorizeVoiceRetentionRequest(authorizedRequest()), true);
  assert.equal(authorizeVoiceRetentionRequest(new Request("https://wildworks.example", {
    headers: { Authorization: "Bearer wrong" },
  })), false);
  delete process.env.CRON_SECRET;
  process.env.WILDWORKS_VOICE_CRON_SECRET = CRON_SECRET;
  assert.equal(authorizeVoiceRetentionRequest(authorizedRequest()), false);
});

test("retention is fail-closed but allows an authenticated dry-run mode", { concurrency: false }, () => {
  resetEnv();
  assert.equal(isVoiceRetentionEnabled(), false);
  process.env.WILDWORKS_VOICE_RETENTION_ENABLED = "true";
  assert.equal(isVoiceRetentionEnabled(), true);
  assert.equal(isVoiceRetentionDryRun(authorizedRequest("https://wildworks.example/api/internal/voice-retention?dryRun=1")), true);
  process.env.WILDWORKS_VOICE_RETENTION_DRY_RUN = "true";
  assert.equal(isVoiceRetentionDryRun(authorizedRequest()), true);
  process.env.WILDWORKS_VOICE_RETENTION_BATCH_LIMIT = "999";
  assert.equal(voiceRetentionBatchLimit(), 25);
});

test("Twilio deletion prefers the restricted recordings API key and verifies 204", { concurrency: false }, async () => {
  resetEnv();
  process.env.TWILIO_AUTH_TOKEN = "broad-account-token-must-not-be-used";
  process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SID = API_KEY_SID;
  process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SECRET = "restricted-recordings-secret";
  let calls = 0;
  const result = await deleteTwilioRecording(RECORDING_SID, async (url, init) => {
    calls += 1;
    assert.equal(url, `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Recordings/${RECORDING_SID}.json`);
    assert.equal(init.method, "DELETE");
    const encoded = init.headers.Authorization.slice("Basic ".length);
    assert.equal(Buffer.from(encoded, "base64").toString("utf8"), `${API_KEY_SID}:restricted-recordings-secret`);
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(result, { ok: true, alreadyAbsent: false });
  assert.equal(calls, 1);
});

test("Twilio deletion treats a verified 404 as idempotently absent", { concurrency: false }, async () => {
  resetEnv();
  process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SID = API_KEY_SID;
  process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SECRET = "restricted-recordings-secret";
  const result = await deleteTwilioRecording(
    RECORDING_SID,
    async () => new Response(null, { status: 404 }),
  );
  assert.deepEqual(result, { ok: true, alreadyAbsent: true });
});

test("Twilio deletion fails closed without a restricted key unless account auth is explicitly enabled", { concurrency: false }, async () => {
  resetEnv();
  process.env.TWILIO_AUTH_TOKEN = "server-account-token";
  let calls = 0;
  const rejected = await deleteTwilioRecording(RECORDING_SID, async () => {
    calls += 1;
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(rejected, { ok: false, errorCode: "twilio_restricted_recordings_key_required" });
  assert.equal(voiceRetentionConfigurationError(), "twilio_restricted_recordings_key_required");
  assert.equal(calls, 0);

  process.env.WILDWORKS_VOICE_RETENTION_ALLOW_ACCOUNT_AUTH = "true";
  const accepted = await deleteTwilioRecording(RECORDING_SID, async (_url, init) => {
    const encoded = init.headers.Authorization.slice("Basic ".length);
    assert.equal(Buffer.from(encoded, "base64").toString("utf8"), `${ACCOUNT_SID}:server-account-token`);
    return new Response(null, { status: 204 });
  });
  assert.equal(accepted.ok, true);
  assert.equal(voiceRetentionConfigurationError(), null);
});

test("dry run returns aggregate counts without claiming or deleting records", async () => {
  let touched = false;
  const result = await executeVoiceRetention(
    { dryRun: true, now: new Date("2026-08-01T00:00:00.000Z") },
    {
      claimRecordings: async () => { touched = true; return { ok: true, value: [] }; },
      completeRecording: async () => { touched = true; return { ok: true, value: true }; },
      failRecording: async () => { touched = true; return { ok: true, value: true }; },
      deleteRecording: async () => { touched = true; return { ok: true, alreadyAbsent: false }; },
      runDatabaseCleanup: async () => { touched = true; return { ok: true, value: {} }; },
      previewDatabaseCleanup: async () => ({
        ok: true,
        value: {
          recordings_due: 2,
          caller_contexts_due: 1,
          voice_messages_due: 3,
          voice_sessions_due: 1,
          sent_outbox_scrub_due: 4,
          outbox_alert_24h_due: 0,
          outbox_alert_7d_due: 1,
          outbox_dead_letter_due: 0,
        },
      }),
      randomToken: () => "unused",
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.preview.recordings_due, 2);
  assert.equal(touched, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${CALL_SID}|${RECORDING_SID}|\\+?1?443`, "i"));
});

test("live retention clears references only after verified provider deletion", async () => {
  const completed = [];
  const failed = [];
  const claims = [
    { call_sid: CALL_SID, recording_sid: RECORDING_SID },
    { call_sid: `CA${"e".repeat(32)}`, recording_sid: `RE${"f".repeat(32)}` },
    { call_sid: `CA${"1".repeat(32)}`, recording_sid: `RE${"2".repeat(32)}` },
  ];
  const result = await executeVoiceRetention(
    { now: new Date("2026-08-01T00:00:00.000Z"), limit: 10 },
    {
      claimRecordings: async () => ({ ok: true, value: claims }),
      completeRecording: async (claim) => { completed.push(claim.recording_sid); return { ok: true, value: true }; },
      failRecording: async (claim, _lease, code) => { failed.push([claim.recording_sid, code]); return { ok: true, value: true }; },
      deleteRecording: async (recordingSid) => recordingSid === claims[0].recording_sid
        ? { ok: true, alreadyAbsent: false }
        : recordingSid === claims[1].recording_sid
          ? { ok: true, alreadyAbsent: true }
          : { ok: false, errorCode: "twilio_delete_http_503" },
      runDatabaseCleanup: async () => ({
        ok: true,
        value: {
          messages_deleted: 2,
          sessions_deleted: 1,
          caller_contexts_deleted: 1,
          sent_outbox_scrubbed: 1,
          outbox_dead_lettered: 0,
          outbox_alerts_24h_marked: 0,
          outbox_alerts_7d_marked: 0,
        },
      }),
      previewDatabaseCleanup: async () => ({ ok: false, errorCode: "unused" }),
      randomToken: () => "00000000-0000-4000-8000-000000000000",
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.recordingsDeleted, 1);
  assert.equal(result.recordingsAlreadyAbsent, 1);
  assert.equal(result.recordingDeleteFailures, 1);
  assert.deepEqual(completed.sort(), [claims[0].recording_sid, claims[1].recording_sid].sort());
  assert.deepEqual(failed, [[claims[2].recording_sid, "twilio_delete_http_503"]]);
});

test("migration encodes bounded holds, retention windows, dead-lettering, and service-role-only RPCs", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202608010004_voice_retention.sql", import.meta.url), "utf8");
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /interval '365 days'/);
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /retention_hold boolean not null default false/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /recording_sid is null[\s\S]*delete_after <= p_now/);
  assert.match(sql, /status = 'dead_letter'/);
  assert.doesNotMatch(sql, /set search_path = public/);
  assert.match(sql, /set search_path = pg_catalog/);
  assert.match(sql, /create or replace function public\.set_voice_retention_hold/);
  assert.match(sql, /update public\.voice_email_outbox[\s\S]*external_call_id = p_external_call_id/);
  assert.match(sql, /revoke all on function public\.run_voice_data_retention[\s\S]*anon, authenticated/);
  assert.match(sql, /grant execute on function public\.run_voice_data_retention[\s\S]*to service_role/);
});

test("Vercel schedules both workers at Hobby-safe daily frequency", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [
    { path: "/api/internal/voice-retention", schedule: "0 5 * * *" },
    { path: "/api/internal/voice-email-drain", schedule: "0 7 * * *" },
  ]);
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});
