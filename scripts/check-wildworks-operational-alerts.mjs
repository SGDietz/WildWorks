import assert from "node:assert/strict";
import {
  classifyOperationalTelemetryEvent,
  classifySupabaseOperationalFailure,
  createConnectivityMissGate,
  compactSafeText,
  formatOperationalAlert,
} from "../src/lib/wildworksOperationalAlertPolicy.mjs";

assert.equal(classifyOperationalTelemetryEvent({ eventType: "liveavatar_token_created" }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "iscott_lead_email_sent" }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "iscott_lead_test_held" }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "validation_error", statusCode: 400 }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "expected_user_cancellation" }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 404, failStreak: 1 }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 404, failStreak: 2 }), null);
assert.ok(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 404, failStreak: 3 }));
assert.ok(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 503, failStreak: 1 }));
assert.ok(classifyOperationalTelemetryEvent({ eventType: "voice_email_drain_unavailable", statusCode: 503 }));
assert.ok(classifyOperationalTelemetryEvent({ eventType: "voice_transcription_fallback_failed", statusCode: 503 }));
for (const eventType of [
  "liveavatar_transcript_owner_check_unavailable",
  "liveavatar_transcript_owner_mismatch",
  "liveavatar_origin_rejected",
  "iscott_false_handoff_speech_detected",
]) {
  assert.ok(classifyOperationalTelemetryEvent({ eventType, route: "/pages/avatar-iscott", sessionId: "private-session" }),
    `${eventType} must produce an actionable WildWorks incident`);
}
// The duplicate server-side observation defers to the client streak and never
// raises its own 404 alert, but non-404 server failures still classify.
assert.equal(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 404, deferToClientStreak: true }), null);
assert.equal(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 404, failStreak: 9, deferToClientStreak: true }), null);
assert.ok(classifyOperationalTelemetryEvent({ eventType: "liveavatar_transcript_sync_failed", statusCode: 500, deferToClientStreak: true }));

const alert = classifyOperationalTelemetryEvent({
  eventType: "iscott_media_store_failed",
  provider: "supabase",
  route: "/api/media/capture?email=private@example.com",
  statusCode: 502,
  sessionId: "private-session-id",
});
assert.ok(alert);
assert.equal(alert.category, "supabase_storage");
assert.equal(alert.route, "/api/media/capture");
assert.match(alert.correlationId, /^ww-[a-f0-9]{12}$/);
assert.doesNotMatch(JSON.stringify(alert), /private-session-id|private@example\.com/);

const text = formatOperationalAlert({
  ...alert,
  summary: "Bearer: secret-token visitor@example.com +1 (443) 555-1212 https://example.com/?secret=yes",
}, "2026-08-21T12:00:00.000Z");
assert.doesNotMatch(text, /secret-token|visitor@example\.com|555-1212|secret=yes/);
assert.match(text, /\[redacted\]|\[email\]|\[phone\]|\[url\]/);
assert.match(text, /company: WildWorks/);
assert.match(text, /environment: runtime/);
assert.match(text, /severity: high/);
assert.match(text, /stage: iScott media storage/);
assert.equal(compactSafeText("expected cancellation"), "expected cancellation");

const { readFileSync } = await import("node:fs");
const readSource = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const alertSource = readSource("../src/lib/wildworksOperationalAlerts.ts");
assert.match(alertSource, /process\.env\.TELEGRAM_ALERT_BOT_TOKEN/);
assert.match(alertSource, /process\.env\.TELEGRAM_ALERT_CHAT_ID/);
assert.doesNotMatch(alertSource, /NEXT_PUBLIC_TELEGRAM/);
// Dispatch admission wiring: the miss gate is bounded, is consulted only for the
// connectivity category, and the 10-minute dedupe stays in front of every send.
assert.match(alertSource, /createConnectivityMissGate\(\{\s*threshold:\s*2,\s*windowMs:\s*60_000\s*\}\)/);
assert.match(alertSource, /alert\.category === "supabase_connectivity" && !admitConnectivity\(/);
assert.match(alertSource, /const DEDUPE_MS = 10 \* 60 \* 1000;/);
assert.match(alertSource, /failStreak\?: number \| null;/);
assert.match(alertSource, /deferToClientStreak\?: boolean;/);

// Both telemetry entry points must forward the streak, and the duplicate
// server-side sync observation must mark itself as deferring to the client.
for (const relativePath of ["../app/api/app-events/log/route.ts", "../src/lib/serverTelemetryCapture.ts"]) {
  const source = readSource(relativePath);
  assert.match(source, /queueOperationalAlertFromTelemetry\(\{/, relativePath);
  assert.match(source, /failStreak:[\s\S]{0,240}Number\.isFinite\(value\)/, relativePath);
}
const captureSource = readSource("../src/lib/serverTelemetryCapture.ts");
assert.match(captureSource, /deferToClientStreak: args\.deferToClientStreak === true/);
// Admission-only: the marker must never reach the stored app_events row.
const rowStart = captureSource.indexOf("const row = {");
assert.notEqual(rowStart, -1);
const rowLiteral = captureSource.slice(rowStart, captureSource.indexOf("\n  };", rowStart));
assert.doesNotMatch(rowLiteral, /deferToClientStreak/);
const syncSource = readSource("../app/api/liveavatar/session-transcript/sync/route.ts");
assert.match(syncSource, /eventType: "liveavatar_transcript_sync_failed"[\s\S]{0,800}deferToClientStreak: true/);
const healthSource = readSource("../app/api/cron/health/route.ts");
assert.match(healthSource, /\/v1\/\$\{resourcePath\}\/\$\{encodeURIComponent\(id\)\}/,
  "health watcher uses exact read-only LiveAvatar resource GET paths");
assert.match(healthSource, /body\?\.data\?\.id === id/,
  "a provider 200 is insufficient unless the exact configured ID resolves");
assert.match(healthSource, /AbortController\(\)[\s\S]{0,500}8_000/,
  "provider health lookups are time bounded");
assert.doesNotMatch(healthSource, /payload:[\s\S]{0,120}(LIVEAVATAR_AVATAR_ID|LIVEAVATAR_CONTEXT_ID|LIVEAVATAR_VOICE_ID)/,
  "configured provider IDs must not enter health telemetry payloads");
assert.match(healthSource, /status=eq\.dead_letter&last_error=neq\.superseded_by_complete_lead/,
  "expected retired partial leads do not create noisy Telegram incidents");
assert.match(healthSource, /notification_status=neq\.sent/,
  "submitted owner-notification drift is monitored");
assert.match(healthSource, /visitor_confirmation_status=in\.\(failed,blocked\)/,
  "partial owner/visitor delivery is monitored rather than silently called success");
assert.match(healthSource, /visitor_confirmation_status=eq\.queued/,
  "stale visitor receipt queues are monitored");
const drainSource = readSource("../app/api/internal/voice-email-drain/route.ts");
assert.match(drainSource, /result\.failed > 0/,
  "actual email failures are distinguished from a drain that could not run");
assert.match(drainSource, /voice_email_drain_unavailable/,
  "zero-delivery-failure drain outages must not masquerade as rejected email");
assert.match(drainSource, /voice_transcription_fallback_failed/,
  "transcription fallback failures retain their own actionable signal");

assert.equal(classifySupabaseOperationalFailure({ component: "leads", operation: "POST table", statusCode: 401 }).category, "supabase_auth");
assert.equal(classifySupabaseOperationalFailure({ component: "uploads", operation: "storage object", statusCode: 503 }).category, "supabase_storage");
assert.equal(classifySupabaseOperationalFailure({ component: "jobs", operation: "RPC cleanup", statusCode: 503 }).category, "supabase_service");
assert.equal(classifySupabaseOperationalFailure({ component: "jobs", operation: "RPC cleanup" }).category, "supabase_connectivity");
assert.equal(classifySupabaseOperationalFailure({ component: "jobs", operation: "RPC cleanup", failureKind: "configuration" }).category, "supabase_configuration");
assert.equal(classifySupabaseOperationalFailure({ component: "database", operation: "POST row", statusCode: 409 }).category, "supabase_database");
assert.equal(classifySupabaseOperationalFailure({ component: "voice email outbox", operation: "POST voice_email_outbox", statusCode: 409 }), null);
assert.ok(classifySupabaseOperationalFailure({ component: "other database", operation: "POST other_table", statusCode: 409 }));

const gate = createConnectivityMissGate({ threshold: 2, windowMs: 60_000 });
assert.equal(gate({ key: "outbox-read", connectivity: true }, 1_000), false);
assert.equal(gate({ key: "outbox-read", connectivity: true }, 2_000), true);
assert.equal(gate({ key: "expired", connectivity: true }, 1_000), false);
assert.equal(gate({ key: "expired", connectivity: true }, 62_000), false);
assert.equal(gate({ key: "auth", connectivity: false }, 1_000), true);

console.log("WildWorks operational alert policy checks passed.");
