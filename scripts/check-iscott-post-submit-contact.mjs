// Current-package truth after a submitted iScott lead changes contact.
// Production capture code runs against local in-memory Supabase/notifier fakes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-post-submit-contact-test");
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
await write("stub-ui", `export function visitorChoseContactMethod(text) {
  if (/\\b(?:phone|call|number)\\b/i.test(text)) return "phone";
  if (/\\b(?:email|mail)\\b/i.test(text)) return "email";
  return null;
}
`);
await write("stub-security", `export function truncateUtf8String(value, limit) { return String(value ?? "").slice(0, limit); }
`);
await write("stub-notify", `export const notifyCalls = [];
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(args);
  return { ok: true, status: 200, detail: "", outboxId: "outbox-new", outboxStatus: "sent", queued: true, delivered: true, deduplicated: false, providerMessageId: "provider-new" };
}
`);
await write("stub-supabase", `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() { return { url: "https://local.invalid", serviceRoleKey: "local-key" }; }
`);
await write("stub-alerts", "export function queueSupabaseOperationalAlert() {}\n");
await write("stub-traffic", `export async function classifyTraffic() { return { trafficClass: "public", reason: "local", confidence: 1 }; }
export function trafficColumns(value) { return { traffic_class: value.trafficClass, traffic_reason: value.reason, traffic_confidence: value.confidence }; }
`);
await write("stub-resolve", `export const ISCOTT_TEST_HELD_STATUS = "test_held";
export function canDispatchIScottLeadNotification() { return true; }
`);
// The visitor receipt ships disabled; this check is about the owner package.
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

const Capture = await import(url("iscottLeadCapture"));
const Notify = await import(url("stub-notify"));
const SESSION = "post-submit-contact-session";
const OLD_EMAIL = "first@example.com";
const NEW_PHONE = "+1 (443) 555-0199";
const SUBMITTED_AT = "2026-08-29T14:00:00.000Z";
const ASK = "May I send these details to Scott?";
const phoneProof = (phone, start = 40) => [
  { role: "assistant", message: `I have your phone as ${phone}. Did I get that right?`, laAbsoluteTimestamp: start },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: start + 2 },
  { role: "assistant", message: ASK, laAbsoluteTimestamp: start + 4 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: start + 6 },
];
const emailProof = (email, start = 10) => [
  { role: "assistant", message: `I have your email as ${email}. Did I get that right?`, laAbsoluteTimestamp: start },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: start + 2 },
  { role: "assistant", message: ASK, laAbsoluteTimestamp: start + 4 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: start + 6 },
];
const persisted = (rows) => rows.map((row) => ({
  role: row.role,
  message: row.message,
  timestamp: row.laAbsoluteTimestamp,
}));

function submittedRow(overrides = {}) {
  return {
    session_id: SESSION,
    anonymous_visitor_id: null,
    source_route: "/pages/avatar-iscott",
    status: "submitted",
    consent_status: "accepted",
    full_name: "Sample Visitor",
    location: "Northlake",
    project_need: "A pool and a waterfall",
    contact_method: "email",
    email: OLD_EMAIL,
    phone: null,
    contact_confirmed_at: SUBMITTED_AT,
    submitted_at: SUBMITTED_AT,
    notification_outbox_id: "outbox-old",
    notification_status: "sent",
    traffic_class: "public",
    traffic_reason: "local",
    traffic_confidence: 1,
    transcript_text: "",
    transcript_snapshot: persisted(emailProof(OLD_EMAIL)),
    media_snapshot: [],
    metadata: { last_sent_contact: OLD_EMAIL },
    created_at: "2026-08-29T13:00:00.000Z",
    updated_at: SUBMITTED_AT,
    ...overrides,
  };
}

function backend(initialRow, transcriptRows = []) {
  const store = { row: structuredClone(initialRow), transcriptRows: [...transcriptRows] };
  const writes = [];
  const response = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  });
  const fetchImpl = async (target, init = {}) => {
    const resource = String(target).split("/rest/v1/")[1] ?? String(target);
    const method = init.method ?? "GET";
    if (resource.startsWith("iscott_leads")) {
      if (method === "POST") {
        const incoming = JSON.parse(init.body)[0];
        store.row = { ...store.row, ...incoming };
        writes.push(structuredClone(store.row));
      }
      return response(200, store.row ? [structuredClone(store.row)] : []);
    }
    if (resource.startsWith("conversation_messages")) return response(200, store.transcriptRows);
    if (resource.startsWith("iscott_media")) return response(200, []);
    return response(200, []);
  };
  return { store, writes, fetchImpl };
}

const realFetch = globalThis.fetch;
async function runCase(initialRow, incoming, transcriptRows = []) {
  const local = backend(initialRow, transcriptRows);
  Notify.notifyCalls.length = 0;
  globalThis.fetch = local.fetchImpl;
  try {
    const result = await Capture.processIScottTranscriptRows({
      sessionId: SESSION,
      route: "/pages/avatar-iscott",
      rows: incoming,
    });
    return { ...local, result, notifyCalls: [...Notify.notifyCalls] };
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A stale proof for the new phone deliberately exists in historical transcript.
// Merely changing to it now cannot reuse that old yes.
{
  const stalePhoneProof = phoneProof("443-555-0199", 20);
  const old = submittedRow({
    transcript_snapshot: persisted([...stalePhoneProof, ...emailProof(OLD_EMAIL)]),
  });
  const change = [{
    role: "user",
    message: `Actually, please call me at ${NEW_PHONE}.`,
    laAbsoluteTimestamp: 60,
  }];
  const { store, notifyCalls } = await runCase(old, change);
  assert.equal(store.row.status, "ready_for_confirmation");
  assert.equal(store.row.consent_status, "unknown");
  assert.equal(store.row.contact_confirmed_at, null);
  assert.equal(store.row.submitted_at, null);
  assert.equal(store.row.notification_outbox_id, null);
  assert.equal(store.row.notification_status, null);
  assert.equal(notifyCalls.length, 0, "historical proof must not authorize the new current package");
  assert.deepEqual(store.row.metadata.submitted_package_history, [{
    submitted_at: SUBMITTED_AT,
    notification_outbox_id: "outbox-old",
    notification_status: "sent",
    contact_method: "email",
  }]);
  assert.equal(store.row.metadata.last_sent_contact, OLD_EMAIL,
    "prior package identity remains available for current-vs-sent comparison");

  // A later sync must keep the same boundary. Without a persisted package
  // marker the second call would scan lifetime history, find the stale phone
  // proof above, and silently spend it after the change call returned.
  const later = await runCase(structuredClone(store.row), [{
    role: "user",
    message: "Thanks, that is all for now.",
    laAbsoluteTimestamp: 70,
  }]);
  assert.equal(later.store.row.consent_status, "unknown");
  assert.equal(later.store.row.contact_confirmed_at, null);
  assert.equal(later.notifyCalls.length, 0,
    "a later sync still may not reuse pre-boundary proof for the changed contact");

  const freshProof = phoneProof("443-555-0199", 72);
  const completed = await runCase(
    structuredClone(later.store.row),
    freshProof,
    freshProof.map((row) => ({
      role: row.role,
      message: row.message,
      la_absolute_timestamp: row.laAbsoluteTimestamp,
    })),
  );
  assert.equal(completed.notifyCalls.length, 1,
    "fresh read-back and adjacent permission may complete the changed package on a later sync");
  assert.equal(completed.store.row.notification_outbox_id, "outbox-new");
}

// Formatting/case-only repetition is the same package: all submitted truth and
// its pointer remain in place and no owner notification is reissued.
{
  const equivalent = [{
    role: "user",
    message: "Actually, my email is FIRST@EXAMPLE.COM.",
    laAbsoluteTimestamp: 60,
  }];
  const { store, notifyCalls } = await runCase(submittedRow(), equivalent);
  assert.equal(store.row.status, "submitted");
  assert.equal(store.row.consent_status, "accepted");
  assert.equal(store.row.contact_confirmed_at, SUBMITTED_AT);
  assert.equal(store.row.notification_outbox_id, "outbox-old");
  assert.equal(store.row.metadata.submitted_package_history, undefined);
  assert.equal(notifyCalls.length, 0);
}

// A changed contact followed by a fresh exact read-back and adjacent permission
// is a new package. It sends once, keeps the old package in history, and points
// current submission fields at the new outbox.
{
  const change = {
    role: "user",
    message: `Actually, please call me at ${NEW_PHONE}.`,
    laAbsoluteTimestamp: 60,
  };
  const proof = phoneProof("443-555-0199", 62);
  const incoming = [change, ...proof];
  const transcriptRows = incoming.map((row) => ({
    role: row.role,
    message: row.message,
    la_absolute_timestamp: row.laAbsoluteTimestamp,
  }));
  const { store, notifyCalls } = await runCase(submittedRow(), incoming, transcriptRows);
  assert.equal(notifyCalls.length, 1);
  assert.equal(notifyCalls[0].contactMethod, "phone");
  assert.equal(store.row.status, "submitted");
  assert.equal(store.row.consent_status, "accepted");
  assert.equal(store.row.notification_outbox_id, "outbox-new");
  assert.equal(store.row.notification_status, "sent");
  assert.deepEqual(store.row.metadata.submitted_package_history, [{
    submitted_at: SUBMITTED_AT,
    notification_outbox_id: "outbox-old",
    notification_status: "sent",
    contact_method: "email",
  }]);
}

console.log("iScott post-submit current-contact separation check OK.");
