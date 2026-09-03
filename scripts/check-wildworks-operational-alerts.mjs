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
assert.equal(compactSafeText("expected cancellation"), "expected cancellation");

const alertSource = await import("node:fs").then(({ readFileSync }) => readFileSync(new URL("../src/lib/wildworksOperationalAlerts.ts", import.meta.url), "utf8"));
assert.match(alertSource, /process\.env\.TELEGRAM_ALERT_BOT_TOKEN/);
assert.match(alertSource, /process\.env\.TELEGRAM_ALERT_CHAT_ID/);
assert.doesNotMatch(alertSource, /NEXT_PUBLIC_TELEGRAM/);

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
