import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import twilio from "twilio";
import {
  buildIncomingCallTwiML,
  buildConversationEndedTwiML,
  buildMenuSelectionTwiML,
  buildVoicemailTwiML,
  buildVoicemailFinishedTwiML,
  conversationRelayConfig,
  parseConversationRelayHandoffData,
  validateTwilioWebhook,
  voiceRouteUrls,
  WILDWORKS_AI_DISCLOSURE,
  WILDWORKS_MENU_PROMPT,
} from "../src/lib/twilioVoiceWebhooks.ts";
import {
  createVoiceRecordingPlaybackUrl,
  validateVoiceRecordingPlayback,
} from "../src/lib/voiceRecordingPlayback.ts";
import {
  classifyVoiceRecordingCallback,
  classifyVoiceTranscriptionCallback,
} from "../src/lib/voiceVoicemailCallbacks.ts";
import {
  createVoiceEventSignature,
  parseInternalVoiceEvent,
  validateVoiceEventSignature,
} from "../src/lib/voiceEventSecurity.ts";
import {
  isVoiceEmailOutboxRowDue,
  voiceEmailRetryDelayMs,
} from "../src/lib/voiceEmailOutboxPolicy.ts";
import {
  voiceLeadEmailIdempotencyKey,
  voiceLeadNotificationEventId,
  voicemailEmailIdempotencyKey,
  voicemailFallbackEventId,
  voicemailTranscriptEventId,
} from "../src/lib/voiceNotificationIds.ts";
import { voiceBackendSignal } from "../src/lib/voiceFetchTimeouts.ts";
import { voiceRuntimeEnvironmentReady } from "../src/lib/voiceEnvReadiness.ts";
import { authorizeVoiceEmailDrainRequest } from "../src/lib/voiceCronAuthorization.ts";

const ORIGINAL_ENV = { ...process.env };
const PUBLIC_URL = "https://voice.wildworks.example/api/voice/incoming";

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  process.env.TWILIO_ACCOUNT_SID = "AC123";
  process.env.TWILIO_VOICE_PUBLIC_BASE_URL = "https://voice.wildworks.example";
}

function signedRequest(url, params, valid = true) {
  const signature = twilio.getExpectedTwilioSignature(
    process.env.TWILIO_AUTH_TOKEN,
    url,
    params,
  );
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": valid ? signature : "invalid",
    },
    body: new URLSearchParams(params).toString(),
  });
}

test("accepts a correctly signed Twilio webhook", { concurrency: false }, async () => {
  resetEnv();
  const result = await validateTwilioWebhook(
    signedRequest(PUBLIC_URL, { AccountSid: "AC123", CallSid: "CA123" }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.params.CallSid, "CA123");
});

test("rejects an invalid Twilio signature", { concurrency: false }, async () => {
  resetEnv();
  const result = await validateTwilioWebhook(
    signedRequest(PUBLIC_URL, { AccountSid: "AC123", CallSid: "CA123" }, false),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 403);
});

test("voice backend timeout signal aborts a hung request quickly", { concurrency: false }, async () => {
  resetEnv();
  process.env.WILDWORKS_VOICE_BACKEND_TIMEOUT_MS = "100";
  const started = Date.now();
  const signal = voiceBackendSignal();
  await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  assert.equal(signal.aborted, true);
  assert.ok(Date.now() - started < 1_000);
});

test("event readiness fails closed unless the complete production voice env is present", () => {
  const complete = {
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "t".repeat(32),
    TWILIO_VOICE_PUBLIC_BASE_URL: "https://www.wildworks.live",
    PUBLIC_WSS_URL:
      "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay",
    TWILIO_CONVERSATION_RELAY_TTS_PROVIDER: "ElevenLabs",
    TWILIO_CONVERSATION_RELAY_VOICE: "voice-id-model-settings",
    RESEND_API_KEY: "r".repeat(32),
    RESEND_FROM_EMAIL: "notifications@wildworks.ai",
    WILDWORKS_VOICE_NOTIFY_EMAIL: "wildworks@example.com",
    WILDWORKS_VOICE_EVENT_SECRET: "e".repeat(32),
    WILDWORKS_VOICE_PLAYBACK_SECRET: "p".repeat(32),
    WILDWORKS_VOICE_CRON_SECRET: "c".repeat(32),
  };
  assert.equal(voiceRuntimeEnvironmentReady(complete), true);
  assert.equal(voiceRuntimeEnvironmentReady({ ...complete, RESEND_API_KEY: "" }), false);
  assert.equal(
    voiceRuntimeEnvironmentReady({
      ...complete,
      PUBLIC_WSS_URL: "wss://example.com/twilio/conversationrelay",
    }),
    false,
  );
  assert.equal(
    voiceRuntimeEnvironmentReady({
      ...complete,
      TWILIO_VOICE_PUBLIC_BASE_URL: "https://example.com",
    }),
    false,
  );
});

test("email drain accepts either the Render or Vercel cron secret independently", () => {
  const renderSecret = "render-maintenance-secret-that-is-at-least-32-bytes";
  const vercelSecret = "vercel-cron-secret-that-is-at-least-32-bytes";
  const env = {
    WILDWORKS_VOICE_CRON_SECRET: renderSecret,
    CRON_SECRET: vercelSecret,
  };

  assert.equal(authorizeVoiceEmailDrainRequest(new Request(
    "https://www.wildworks.live/api/internal/voice-email-drain",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${renderSecret}` },
    },
  ), env), true);
  assert.equal(authorizeVoiceEmailDrainRequest(new Request(
    "https://www.wildworks.live/api/internal/voice-email-drain",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${vercelSecret}` },
    },
  ), env), true);
  assert.equal(authorizeVoiceEmailDrainRequest(new Request(
    "https://www.wildworks.live/api/internal/voice-email-drain",
    { headers: { Authorization: "Bearer definitely-wrong" } },
  ), env), false);
});

test("email drain fails closed when cron secrets are missing or too short", () => {
  const request = new Request(
    "https://www.wildworks.live/api/internal/voice-email-drain",
    { headers: { Authorization: `Bearer ${"x".repeat(32)}` } },
  );
  assert.equal(authorizeVoiceEmailDrainRequest(request, {}), false);
  assert.equal(authorizeVoiceEmailDrainRequest(request, {
    WILDWORKS_VOICE_CRON_SECRET: "short",
    CRON_SECRET: "also-short",
  }), false);
  assert.equal(authorizeVoiceEmailDrainRequest(new Request(
    "https://www.wildworks.live/api/internal/voice-email-drain",
  ), { CRON_SECRET: "x".repeat(32) }), false);
});

test("incoming TwiML discloses AI use and gathers one DTMF digit", { concurrency: false }, () => {
  resetEnv();
  const xml = buildIncomingCallTwiML(voiceRouteUrls(PUBLIC_URL));
  assert.match(xml, /<Gather[^>]*input="dtmf"[^>]*numDigits="1"/);
  assert.ok(xml.includes("Press 1 to continue talking to iScott"));
  assert.ok(xml.includes("press 2 to leave a voice mail"));
  assert.ok(xml.includes(WILDWORKS_AI_DISCLOSURE.replaceAll("'", "&apos;")) || xml.includes("Welcome to WildWorks"));
  assert.ok(xml.includes(WILDWORKS_MENU_PROMPT.replaceAll("'", "&apos;")) || xml.includes("Press 1"));
  assert.ok(xml.indexOf("</Say><Gather") > xml.indexOf("Welcome to WildWorks"));
  assert.ok(xml.indexOf("Press 1") > xml.indexOf("<Gather"));
  assert.doesNotMatch(xml, /<Dial/);
});

test("press 1 connects to ConversationRelay with ElevenLabs and an action URL", { concurrency: false }, () => {
  resetEnv();
  process.env.PUBLIC_WSS_URL = "wss://voice-agent.wildworks.example/socket";
  process.env.TWILIO_CONVERSATION_RELAY_TTS_PROVIDER = "ElevenLabs";
  process.env.TWILIO_CONVERSATION_RELAY_VOICE = "voice-id-model-settings";
  const urls = voiceRouteUrls(PUBLIC_URL);
  const xml = buildMenuSelectionTwiML("1", urls, conversationRelayConfig(PUBLIC_URL));
  assert.match(xml, /<Connect[^>]*action="https:\/\/voice\.wildworks\.example\/api\/voice\/conversation-ended"/);
  assert.match(xml, /<ConversationRelay[^>]*ttsProvider="ElevenLabs"/);
  assert.match(xml, /voice="voice-id-model-settings"/);
  assert.match(xml, /url="wss:\/\/voice-agent\.wildworks\.example\/socket"/);
  assert.doesNotMatch(xml, /<Dial/);
});

test("production locks public callbacks and ConversationRelay to owned hosts", { concurrency: false }, async () => {
  resetEnv();
  process.env.NODE_ENV = "production";
  process.env.TWILIO_VOICE_PUBLIC_BASE_URL = "https://example.com";
  process.env.PUBLIC_WSS_URL = "wss://example.com/twilio/conversationrelay";
  const rejected = await validateTwilioWebhook(
    signedRequest(PUBLIC_URL, { AccountSid: "AC123", CallSid: "CA123" }),
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.response.status, 503);
  assert.equal(conversationRelayConfig(PUBLIC_URL).publicWssUrl, null);

  process.env.TWILIO_VOICE_PUBLIC_BASE_URL = "https://www.wildworks.live";
  process.env.PUBLIC_WSS_URL =
    "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay";
  const config = conversationRelayConfig("https://www.wildworks.live/api/voice/menu");
  assert.equal(
    config.publicWssUrl,
    "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay",
  );
  assert.equal(
    config.actionUrl,
    "https://www.wildworks.live/api/voice/conversation-ended",
  );
});

test("press 2, invalid input, and missing WebSocket all fail to business voicemail", { concurrency: false }, () => {
  resetEnv();
  delete process.env.PUBLIC_WSS_URL;
  const urls = voiceRouteUrls(PUBLIC_URL);
  for (const digit of ["2", "9", null, "1"]) {
    const xml = buildMenuSelectionTwiML(digit, urls, conversationRelayConfig(PUBLIC_URL));
    assert.match(xml, /<Record/);
    assert.match(xml, /recordingStatusCallback="https:\/\/voice\.wildworks\.example\/api\/voice\/recording-complete"/);
    assert.match(xml, /transcribe="true"/);
    assert.match(xml, /transcribeCallback="https:\/\/voice\.wildworks\.example\/api\/voice\/transcription-complete"/);
    assert.match(xml, /maxLength="119"/);
    assert.doesNotMatch(xml, /<Dial/);
  }
});

test("voicemail Record is the final reachable verb when an action callback is set", { concurrency: false }, () => {
  resetEnv();
  const xml = buildVoicemailTwiML(voiceRouteUrls(PUBLIC_URL));
  assert.match(xml, /<Record[^>]*\/><\/Response>$/);
  assert.doesNotMatch(xml, /<Record[^>]*\/>.*<Say/);
  assert.doesNotMatch(xml, /<Dial/);
});

test("accepts a signed native transcription callback and rejects tampering", { concurrency: false }, async () => {
  resetEnv();
  const url = "https://voice.wildworks.example/api/voice/transcription-complete";
  const params = {
    AccountSid: "AC123",
    CallSid: "CA123",
    RecordingSid: "RE123",
    TranscriptionStatus: "completed",
    TranscriptionText: "A project in Baltimore",
  };
  const accepted = await validateTwilioWebhook(signedRequest(url, params));
  assert.equal(accepted.ok, true);
  const rejected = await validateTwilioWebhook(signedRequest(url, { ...params, TranscriptionText: "tampered" }, false));
  assert.equal(rejected.ok, false);
});

test("classifies transcript success and clear transcription failures", () => {
  assert.deepEqual(classifyVoiceTranscriptionCallback("completed", "  useful transcript  "), {
    kind: "success",
    transcript: "useful transcript",
  });
  assert.equal(classifyVoiceTranscriptionCallback("failed", null).kind, "failure");
  assert.equal(classifyVoiceTranscriptionCallback("completed", "").kind, "failure");
  assert.equal(classifyVoiceRecordingCallback("completed", "3").kind, "await_transcription");
  assert.equal(classifyVoiceRecordingCallback("completed", "2").kind, "notify_failure");
  assert.equal(classifyVoiceRecordingCallback("absent", null).kind, "notify_failure");
});

test("secure recording playback links expire and reject tampering", { concurrency: false }, () => {
  resetEnv();
  process.env.WILDWORKS_VOICE_PLAYBACK_SECRET = "test-playback-secret-that-is-at-least-32-bytes";
  process.env.WILDWORKS_VOICE_PLAYBACK_TTL_SECONDS = "3600";
  const recordingSid = `RE${"a".repeat(32)}`;
  const now = 2_000_000_000;
  const playbackUrl = createVoiceRecordingPlaybackUrl(recordingSid, PUBLIC_URL, now);
  assert.ok(playbackUrl);
  assert.deepEqual(validateVoiceRecordingPlayback(playbackUrl, now + 10), {
    ok: true,
    recordingSid,
    expiresAt: now + 3600,
  });
  const tampered = new URL(playbackUrl);
  tampered.searchParams.set("sid", `RE${"b".repeat(32)}`);
  assert.deepEqual(validateVoiceRecordingPlayback(tampered, now + 10), { ok: false, reason: "invalid" });
  assert.deepEqual(validateVoiceRecordingPlayback(playbackUrl, now + 3601), { ok: false, reason: "expired" });

  process.env.WILDWORKS_VOICE_PLAYBACK_TTL_SECONDS = String(30 * 24 * 60 * 60);
  const clampedUrl = createVoiceRecordingPlaybackUrl(recordingSid, PUBLIC_URL, now);
  assert.ok(clampedUrl);
  assert.equal(new URL(clampedUrl).searchParams.get("exp"), String(now + 86_400));
  assert.deepEqual(validateVoiceRecordingPlayback(clampedUrl, now + 86_401), { ok: false, reason: "expired" });
});

test("internal voice event signatures cover timestamp and exact raw body", { concurrency: false }, () => {
  resetEnv();
  process.env.WILDWORKS_VOICE_EVENT_SECRET = "test-event-secret-that-is-at-least-32-bytes-long";
  const timestamp = "2000000000";
  const event = {
    version: 1,
    eventId: "evt-voice-start-1",
    eventType: "session_start",
    occurredAt: "2033-05-18T03:33:20.000Z",
    callSid: `CA${"a".repeat(32)}`,
    sessionId: "voice-session-123",
  };
  const body = JSON.stringify(event);
  const signature = createVoiceEventSignature(body, timestamp);
  assert.ok(signature);
  assert.equal(validateVoiceEventSignature({ rawBody: body, timestamp, signature, nowSeconds: 2_000_000_000 }), true);
  assert.equal(validateVoiceEventSignature({ rawBody: `${body} `, timestamp, signature, nowSeconds: 2_000_000_000 }), false);
  assert.equal(validateVoiceEventSignature({ rawBody: body, timestamp, signature, nowSeconds: 2_000_000_301 }), false);
  assert.equal(parseInternalVoiceEvent(event)?.eventType, "session_start");
  const emptySignature = createVoiceEventSignature("", timestamp);
  assert.equal(validateVoiceEventSignature({ rawBody: "", timestamp, signature: emptySignature, nowSeconds: 2_000_000_000 }), true);
});

test("ConversationRelay action hangs up normally and opens voicemail only for explicit handoff", { concurrency: false }, () => {
  resetEnv();
  const urls = voiceRouteUrls(PUBLIC_URL);
  const normal = parseConversationRelayHandoffData(null);
  assert.match(buildConversationEndedTwiML(normal, urls), /<Hangup/);
  assert.doesNotMatch(buildConversationEndedTwiML(normal, urls), /<Record/);
  const voicemail = parseConversationRelayHandoffData('{"target":"voicemail","summary":"Caller requested Scott."}');
  assert.equal(voicemail.target, "voicemail");
  assert.match(buildConversationEndedTwiML(voicemail, urls), /<Record/);
  assert.doesNotMatch(buildConversationEndedTwiML(parseConversationRelayHandoffData("not-json"), urls), /<Record/);
  assert.match(
    buildConversationEndedTwiML(normal, urls, { sessionStatus: "failed" }),
    /<Record/,
  );
  assert.match(
    buildConversationEndedTwiML(normal, urls, { errorCode: "64102" }),
    /<Record/,
  );
  assert.doesNotMatch(
    buildConversationEndedTwiML(normal, urls, { sessionStatus: "ended" }),
    /<Record/,
  );
});

test("runtime session end and signed action share exactly one lead-email key in either arrival order", () => {
  const callSid = `CA${"c".repeat(32)}`;
  const runtimeKey = voiceLeadEmailIdempotencyKey(voiceLeadNotificationEventId(callSid));
  const actionKey = voiceLeadEmailIdempotencyKey(voiceLeadNotificationEventId(callSid));
  assert.equal(new Set([runtimeKey, actionKey]).size, 1);
  assert.equal(new Set([actionKey, runtimeKey]).size, 1);
});

test("delayed voicemail fallback and a late transcript use distinct stable keys", () => {
  const callSid = `CA${"c".repeat(32)}`;
  const recordingSid = `RE${"d".repeat(32)}`;
  const transcriptionSid = `TR${"e".repeat(32)}`;
  const fallback = voicemailEmailIdempotencyKey(voicemailFallbackEventId(recordingSid, callSid));
  const lateTranscript = voicemailEmailIdempotencyKey(voicemailTranscriptEventId(transcriptionSid, recordingSid));
  assert.notEqual(fallback, lateTranscript);
  assert.equal(new Set([fallback, lateTranscript]).size, 2);
});

test("recording callback only persists context and ConversationRelay action consumes documented fields", () => {
  const recordingRoute = readFileSync(new URL("../app/api/voice/recording-complete/route.ts", import.meta.url), "utf8");
  assert.match(recordingRoute, /upsertVoiceRecording/);
  assert.doesNotMatch(recordingRoute, /notifyVoicemailByEmail/);
  const endedRoute = readFileSync(new URL("../app/api/voice/conversation-ended/route.ts", import.meta.url), "utf8");
  for (const field of ["CallSid", "SessionId", "SessionStatus", "SessionDuration", "From", "HandoffData"]) {
    assert.ok(endedRoute.includes(`\"${field}\"`), `missing ${field}`);
  }
});

test("outbox retry eligibility recovers expired leases with bounded backoff", () => {
  const now = Date.parse("2026-08-01T12:00:00.000Z");
  assert.equal(isVoiceEmailOutboxRowDue({ status: "failed", updated_at: "2026-08-01T11:00:00.000Z", lease_expires_at: null, next_attempt_at: "2026-08-01T11:59:00.000Z" }, now), true);
  assert.equal(isVoiceEmailOutboxRowDue({ status: "sending", updated_at: "2026-08-01T11:59:30.000Z", lease_expires_at: "2026-08-01T11:59:59.000Z", next_attempt_at: null }, now), true);
  assert.equal(isVoiceEmailOutboxRowDue({ status: "sending", updated_at: "2026-08-01T11:59:30.000Z", lease_expires_at: "2026-08-01T12:04:00.000Z", next_attempt_at: null }, now), false);
  assert.ok(voiceEmailRetryDelayMs(20) <= 6 * 60 * 60 * 1000);
});

test("voicemail completion ends the call without dialing a phone", { concurrency: false }, () => {
  resetEnv();
  const xml = buildVoicemailFinishedTwiML();
  assert.match(xml, /<Hangup/);
  assert.doesNotMatch(xml, /<Dial/);
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});
