// Manual retry semantics for a submitted iScott lead whose linked owner outbox
// failed. Everything is local: Supabase, the outbox lease, and the provider are
// deterministic in-memory fakes around the production lead-capture function.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-failed-retry-backend-test");
await fs.mkdir(out, { recursive: true });
const url = (name) => `file:///${path.join(out, `${name}.mjs`).split(path.sep).join("/")}`;
const write = (name, source) => fs.writeFile(path.join(out, `${name}.mjs`), source, "utf8");
async function transpile(sourcePath, name, rewrites = []) {
  let source = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  await write(name, source);
}

await transpile("src/lib/iscottSalesCopy.ts", "iscottSalesCopy");
await transpile("src/lib/iscottLeadParsing.ts", "iscottLeadParsing", [
  ['from "./iscottSalesCopy"', 'from "./iscottSalesCopy.mjs"'],
]);
await write("stub-ui", `export function visitorChoseContactMethod() { return null; }\n`);
await write("stub-security", `export function truncateUtf8String(value, limit) { return String(value ?? "").slice(0, limit); }
export function assertAllowedOrigin() { return null; }
export function isSafeTranscriptionSessionId(value) { return typeof value === "string" && value.length > 0; }
`);
await write("stub-supabase", `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() { return { url: "https://local-project.supabase.invalid", serviceRoleKey: "local-only" }; }
`);
await write("stub-alerts", `export function queueSupabaseOperationalAlert() {}\n`);
await write("stub-traffic", `export async function classifyTraffic() { return { trafficClass: "public", reason: "local", confidence: 1 }; }
export function trafficColumns(value) { return { traffic_class: value.trafficClass, traffic_reason: value.reason, traffic_confidence: value.confidence }; }
`);
await write("stub-resolve", `export const ISCOTT_TEST_HELD_STATUS = "test_held";
export function canDispatchIScottLeadNotification() { return true; }
`);
await write("stub-notify", `export const notifyCalls = [];
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(structuredClone(args));
  const harness = globalThis.__iscottFailedRetryHarness;
  const row = harness.outboxRows[0];
  harness.enqueueLookups += 1;
  if (!row || row.status === "sent") {
    return { ok: true, status: 200, detail: "", outboxId: row?.id ?? null, outboxStatus: row?.status ?? null, queued: Boolean(row), delivered: row?.status === "sent", deduplicated: true, providerMessageId: row?.providerMessageId ?? null };
  }
  if (row.status !== "pending") {
    return { ok: true, status: 202, detail: "voice_email_already_claimed_or_waiting", outboxId: row.id, outboxStatus: row.status, queued: true, delivered: false, deduplicated: true, providerMessageId: null };
  }
  row.status = "sending";
  row.attemptCount += 1;
  harness.claimCalls += 1;
  harness.providerCalls += 1;
  if (harness.providerFails) {
    row.status = "failed";
    return { ok: false, status: 502, detail: "resend_send_failed", outboxId: row.id, outboxStatus: "failed", queued: true, delivered: false, deduplicated: false, providerMessageId: null };
  }
  row.status = "sent";
  row.providerMessageId = "provider-retry-accepted";
  return { ok: true, status: 200, detail: "", outboxId: row.id, outboxStatus: "sent", queued: true, delivered: true, deduplicated: false, providerMessageId: row.providerMessageId };
}
export async function notifyIScottVisitorConfirmationByEmail() {
  return { status: "approval_required", outboxId: null, idempotencyKey: null, packageVersionHash: null, recipient: null, providerAccepted: false, deduplicated: false, blockers: ["feature_not_authorized"] };
}
`);
// The visitor receipt ships disabled; this check is about the owner retry.
await write("stub-visitor-confirmation", `export const ISCOTT_VISITOR_CONFIRMATION_ENABLED = false;
export const ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS = "approval_required";
`);
await transpile("src/lib/iscottLeadCapture.ts", "iscottLeadCapture", [
  ['from "./iscottVisitorConfirmation"', 'from "./stub-visitor-confirmation.mjs"'],
  ['from "./iscottLeadCaptureUi"', 'from "./stub-ui.mjs"'],
  ['from "./apiRouteSecurity"', 'from "./stub-security.mjs"'],
  ['from "./voiceEmailNotifications"', 'from "./stub-notify.mjs"'],
  ['from "./supabaseAdmin"', 'from "./stub-supabase.mjs"'],
  ['from "./wildworksOperationalAlerts"', 'from "./stub-alerts.mjs"'],
  ['from "./iscottLeadParsing"', 'from "./iscottLeadParsing.mjs"'],
  ['from "./trafficClassification"', 'from "./stub-traffic.mjs"'],
  ['from "./iscottTrafficResolve"', 'from "./stub-resolve.mjs"'],
]);
await write("stub-route-capture", `export const state = { result: null };
export async function confirmAndSubmitIScottLead() { return structuredClone(state.result); }
`);
await write("stub-route-rate", `export async function checkRateLimit() { return null; }\n`);
await write("stub-route-telemetry", `export const events = [];
export async function logServerTelemetryEvent(event) {
  events.push({ ...event, request: undefined, payload: structuredClone(event.payload) });
}
export async function logIScottOriginRejection() {}
`);
await transpile("app/api/iscott/lead/confirm/route.ts", "confirmRoute", [
  ['from "../../../../../src/lib/apiRouteSecurity"', 'from "./stub-security.mjs"'],
  ['from "../../../../../src/lib/iscottLeadCapture"', 'from "./stub-route-capture.mjs"'],
  ['from "../../../../../src/lib/iscottLeadParsing"', 'from "./iscottLeadParsing.mjs"'],
  ['from "../../../../../src/lib/rateLimit"', 'from "./stub-route-rate.mjs"'],
  ['from "../../../../../src/lib/serverTelemetryCapture"', 'from "./stub-route-telemetry.mjs"'],
  ['from "../../../../../src/lib/iscottOriginTelemetry"', 'from "./stub-route-telemetry.mjs"'],
]);

const Capture = await import(url("iscottLeadCapture"));
const Notify = await import(url("stub-notify"));
const SESSION = "failed-retry-backend-session";
const EMAIL = "retry.visitor@example.com";
const CONTACT_CONFIRMED_AT = "2026-08-29T17:59:00.000Z";
const SUBMITTED_AT = "2026-08-29T18:00:00.000Z";
const OUTBOX_ID = "owner-outbox-original";
const IDEMPOTENCY_KEY = "iscott-lead-package:original-stable-key";
const proof = [
  { role: "assistant", message: `I have your email as ${EMAIL}. Did I get that right?`, la_absolute_timestamp: 10 },
  { role: "user", message: "Yes, that's right.", la_absolute_timestamp: 12 },
  { role: "assistant", message: "May I send these details to Scott?", la_absolute_timestamp: 14 },
  { role: "user", message: "Yes.", la_absolute_timestamp: 16 },
];

function leadRow(notificationStatus) {
  return {
    session_id: SESSION,
    anonymous_visitor_id: null,
    source_route: "/pages/avatar-iscott",
    status: "submitted",
    consent_status: "accepted",
    full_name: "Solveig Hansen",
    location: "Northlake",
    project_need: "A pool and a waterfall",
    contact_method: "email",
    email: EMAIL,
    phone: null,
    contact_confirmed_at: CONTACT_CONFIRMED_AT,
    submitted_at: SUBMITTED_AT,
    notification_outbox_id: OUTBOX_ID,
    notification_status: notificationStatus,
    traffic_class: "public",
    traffic_reason: "local",
    traffic_confidence: 1,
    transcript_text: "",
    transcript_snapshot: proof.map(({ role, message, la_absolute_timestamp }) => ({ role, message, timestamp: la_absolute_timestamp })),
    media_snapshot: [],
    metadata: { last_sent_contact: EMAIL },
    created_at: "2026-08-29T17:00:00.000Z",
    updated_at: SUBMITTED_AT,
  };
}

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => typeof body === "string" ? body : JSON.stringify(body),
});
const queryValue = (resource, key) => {
  const match = resource.match(new RegExp(`[?&]${key}=eq\\.([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

function backend(initialStatus, { providerFails = false } = {}) {
  const harness = {
    lead: structuredClone(leadRow(initialStatus)),
    outboxRows: [{
      id: OUTBOX_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      status: initialStatus,
      attemptCount: 4,
      providerMessageId: null,
    }],
    providerFails,
    enqueueLookups: 0,
    claimCalls: 0,
    providerCalls: 0,
    outboxPatchCalls: 0,
    outboxPostCalls: 0,
    leadWrites: [],
  };
  const fetchImpl = async (target, init = {}) => {
    const resource = String(target).split("/rest/v1/")[1] ?? String(target);
    const method = init.method ?? "GET";
    if (resource.startsWith("iscott_leads")) {
      if (method === "POST") {
        const incoming = JSON.parse(init.body)[0];
        harness.lead = { ...harness.lead, ...incoming };
        harness.leadWrites.push(structuredClone(harness.lead));
      }
      return response(200, [structuredClone(harness.lead)]);
    }
    if (resource.startsWith("conversation_messages")) return response(200, structuredClone(proof));
    if (resource.startsWith("iscott_media")) return response(200, []);
    if (resource.startsWith("voice_email_outbox")) {
      const row = harness.outboxRows.find((candidate) => candidate.id === (queryValue(resource, "id") ?? OUTBOX_ID));
      if (method === "POST") {
        harness.outboxPostCalls += 1;
        return response(500, "lead capture must never create a retry outbox row directly");
      }
      if (method === "PATCH") {
        harness.outboxPatchCalls += 1;
        const expectedStatus = queryValue(resource, "status");
        if (!row || (expectedStatus && row.status !== expectedStatus)) return response(200, []);
        const patch = JSON.parse(init.body);
        row.status = patch.status;
        return response(200, [{ id: row.id, status: row.status }]);
      }
      return response(200, row ? [{ id: row.id, status: row.status }] : []);
    }
    return response(200, []);
  };
  return { harness, fetchImpl };
}

const realFetch = globalThis.fetch;
async function confirm(initialStatus, options) {
  const local = backend(initialStatus, options);
  Notify.notifyCalls.length = 0;
  globalThis.__iscottFailedRetryHarness = local.harness;
  globalThis.fetch = local.fetchImpl;
  try {
    const result = await Capture.confirmAndSubmitIScottLead({
      sessionId: SESSION,
      contactMethod: "email",
      contactValue: EMAIL,
    });
    return { ...local, result, notifyCalls: structuredClone(Notify.notifyCalls) };
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.__iscottFailedRetryHarness;
  }
}

for (const initialStatus of ["failed", "dead_letter"]) {
  const local = backend(initialStatus);
  Notify.notifyCalls.length = 0;
  globalThis.__iscottFailedRetryHarness = local.harness;
  globalThis.fetch = local.fetchImpl;
  try {
    const first = await Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL });
    assert.equal(local.harness.outboxPatchCalls, 1, `${initialStatus} is explicitly re-armed once`);
    assert.equal(local.harness.claimCalls, 1, `${initialStatus} reaches a real outbox claim`);
    assert.equal(local.harness.providerCalls, 1, `${initialStatus} reaches one provider attempt`);
    assert.equal(Notify.notifyCalls.length, 1);
    assert.equal(local.harness.outboxRows.length, 1);
    assert.equal(local.harness.outboxRows[0].id, OUTBOX_ID);
    assert.equal(local.harness.outboxRows[0].idempotencyKey, IDEMPOTENCY_KEY);
    assert.equal(local.harness.outboxPostCalls, 0);
    assert.equal(first.queued, true);
    assert.equal(first.delivered, true);
    assert.equal(first.lead.notificationStatus, "sent");
    assert.equal(first.lead.notificationOutboxId, OUTBOX_ID);
    assert.equal(first.lead.submittedAt, SUBMITTED_AT);
    assert.equal(first.lead.contactConfirmedAt, CONTACT_CONFIRMED_AT);
    assert.equal(first.lead.consentStatus, "accepted");

    const second = await Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL });
    assert.equal(second.delivered, true);
    assert.equal(local.harness.outboxPatchCalls, 1, "sent second click does not re-arm");
    assert.equal(local.harness.claimCalls, 1, "sent second click does not claim again");
    assert.equal(local.harness.providerCalls, 1, "sent second click does not call the provider again");
    assert.equal(Notify.notifyCalls.length, 1, "sent second click short-circuits before notifier");
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.__iscottFailedRetryHarness;
  }
}

{
  const { harness, result, notifyCalls } = await confirm("failed", { providerFails: true });
  assert.equal(harness.claimCalls, 1);
  assert.equal(harness.providerCalls, 1);
  assert.equal(notifyCalls.length, 1);
  assert.equal(result.queued, true, "the same durable row remains queued for intentional retry");
  assert.equal(result.delivered, false);
  assert.equal(result.detail, "resend_send_failed");
  assert.equal(result.lead.notificationStatus, "failed");
  assert.equal(result.lead.notificationOutboxId, OUTBOX_ID);
  assert.equal(result.lead.submittedAt, SUBMITTED_AT);
  assert.equal(result.lead.consentStatus, "accepted");
  assert.equal(harness.outboxRows.length, 1);
  assert.equal(harness.outboxRows[0].idempotencyKey, IDEMPOTENCY_KEY);
}

for (const settledStatus of ["pending", "sending", "sent"]) {
  const { harness, result, notifyCalls } = await confirm(settledStatus);
  assert.equal(harness.outboxPatchCalls, 0, `${settledStatus} is not manually re-armed`);
  assert.equal(harness.providerCalls, 0, `${settledStatus} does not call the provider`);
  assert.equal(notifyCalls.length, 0, `${settledStatus} dedupes before notifier`);
  assert.equal(result.delivered, settledStatus === "sent");
  assert.equal(result.lead.notificationOutboxId, OUTBOX_ID);
}

const captureSource = await fs.readFile("src/lib/iscottLeadCapture.ts", "utf8");
assert.match(
  captureSource,
  /const alreadyHandled =[\s\S]{0,250}row\.status === "submitted"/,
  "transcript processing must continue to suppress automatic retries of submitted packages",
);

// The HTTP owner must not call a durable failed outbox merely "queued". It
// returns the independent truths together: the package still exists, delivery
// failed, and the visitor can intentionally retry it.
{
  const Route = await import(url("confirmRoute"));
  const RouteCapture = await import(url("stub-route-capture"));
  const RouteTelemetry = await import(url("stub-route-telemetry"));
  const post = () => Route.POST(new Request("https://wildworks.ai/api/iscott/lead/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
  }));
  RouteCapture.state.result = {
    lead: {
      notificationStatus: "failed",
      notificationOutboxId: OUTBOX_ID,
      submittedAt: SUBMITTED_AT,
    },
    queued: true,
    delivered: false,
    detail: "resend_send_failed",
  };
  const failedResponse = await post();
  const failedBody = await failedResponse.json();
  assert.equal(failedResponse.status, 503);
  assert.equal(failedBody.ok, false);
  assert.equal(failedBody.failed, true);
  assert.equal(failedBody.queued, true, "durable queue truth is retained independently of attempt failure");
  assert.equal(failedBody.delivered, false);
  assert.match(failedBody.error, /Scott does not have this yet/i);
  assert.equal(RouteTelemetry.events.at(-1).userVisibleState, "delivery_failed");
  assert.equal(RouteTelemetry.events.at(-1).payload.failed, true);

  RouteCapture.state.result = {
    lead: { notificationStatus: "sent", notificationOutboxId: OUTBOX_ID, submittedAt: SUBMITTED_AT },
    queued: true,
    delivered: true,
    detail: "",
  };
  const sentResponse = await post();
  assert.equal(sentResponse.status, 200);
  assert.equal((await sentResponse.json()).ok, true);
}

console.log("iScott failed/dead-letter backend retry checks passed");
