// A visitor name must be something Scott can actually address. This runs the
// direct parser gate and the production capture/send gate with only local fakes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-meaningful-name-test");
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
const Parsing = await import(url("iscottLeadParsing"));

for (const realName of ["Solveig Hansen", "Cher Bono", "Li Wei", "Jo March", "Saoirse Ronan", "Jean-Luc Picard", "Mary-Anne O'Neill"]) {
  assert.equal(Parsing.isMeaningfulVisitorName(realName), true, `${realName} remains a valid visitor name`);
}

const invalidNames = [
  "Email Address",
  "My Email Address",
  "Phone Number",
  "Contact Information",
  "Preferred Contact Method",
  "First Name",
  "Last Name",
  "Best Time To Call",
  "Call Me",
  "Not Provided",
  "visitor@example.com",
  "(443) 555-0142",
  "four four three five five five zero one four two",
];
for (const invalidName of invalidNames) {
  assert.equal(
    Parsing.isMeaningfulVisitorName(invalidName),
    false,
    `${invalidName} is contact/field data, not a visitor name`,
  );
}

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
  return { ok: true, status: 200, detail: "", outboxId: "outbox-name-test", outboxStatus: "sent", queued: true, delivered: true, deduplicated: false, providerMessageId: "provider-name-test" };
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

const SESSION = "meaningful-name-session";
const EMAIL = "visitor@example.com";
const PROOF = [
  { role: "assistant", message: `I have your email as ${EMAIL}. Did I get that right?`, laAbsoluteTimestamp: 10 },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 12 },
  { role: "assistant", message: "May I send these details to Scott?", laAbsoluteTimestamp: 14 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 16 },
];
const persistedProof = PROOF.map((row) => ({
  role: row.role,
  message: row.message,
  timestamp: row.laAbsoluteTimestamp,
}));

function leadRow(fullName) {
  return {
    session_id: SESSION,
    anonymous_visitor_id: null,
    source_route: "/pages/avatar-iscott",
    status: "ready_for_confirmation",
    consent_status: "accepted",
    full_name: fullName,
    location: "Northlake",
    project_need: "A pool and a waterfall",
    contact_method: "email",
    email: EMAIL,
    phone: null,
    contact_confirmed_at: "2026-08-29T14:00:00.000Z",
    submitted_at: null,
    notification_outbox_id: null,
    notification_status: null,
    traffic_class: "public",
    traffic_reason: "local",
    traffic_confidence: 1,
    transcript_text: "",
    transcript_snapshot: persistedProof,
    media_snapshot: [],
    metadata: {},
    created_at: "2026-08-29T13:00:00.000Z",
    updated_at: "2026-08-29T14:00:00.000Z",
  };
}

function localBackend(initialRow) {
  const store = { row: structuredClone(initialRow) };
  const response = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => "" });
  const fetchImpl = async (target, init = {}) => {
    const resource = String(target).split("/rest/v1/")[1] ?? String(target);
    const method = init.method ?? "GET";
    if (resource.startsWith("iscott_leads")) {
      if (method === "POST") store.row = { ...store.row, ...JSON.parse(init.body)[0] };
      return response([structuredClone(store.row)]);
    }
    if (resource.startsWith("conversation_messages")) {
      return response(PROOF.map((row) => ({
        role: row.role,
        message: row.message,
        la_absolute_timestamp: row.laAbsoluteTimestamp,
      })));
    }
    if (resource.startsWith("iscott_media")) return response([]);
    return response([]);
  };
  return { store, fetchImpl };
}

const realFetch = globalThis.fetch;
async function captureWithName(fullName) {
  const backend = localBackend(leadRow(fullName));
  Notify.notifyCalls.length = 0;
  globalThis.fetch = backend.fetchImpl;
  try {
    await Capture.processIScottTranscriptRows({
      sessionId: SESSION,
      route: "/pages/avatar-iscott",
      rows: [{ role: "user", message: "That is everything.", laAbsoluteTimestamp: 20 }],
    });
    return { backend, notifyCalls: [...Notify.notifyCalls] };
  } finally {
    globalThis.fetch = realFetch;
  }
}

for (const invalidName of [
  "Email Address",
  "Phone Number",
  "Contact Information",
  "visitor@example.com",
  "(443) 555-0142",
  "four four three five five five zero one four two",
]) {
  const { notifyCalls } = await captureWithName(invalidName);
  assert.equal(notifyCalls.length, 0, `${invalidName} must block end-to-end owner notification`);
}

// 2026-08-30. These used to be asserted INVALID, on the rule that a send needs a
// full name and one token is not one. A visitor who is called Cher, or Solveig,
// or Li could therefore never finish - their real answer was thrown away and
// iScott asked for the name again. A legitimate single-word name is a name; what
// the gate refuses is values that are not names at all, and every one of those
// above is still refused.
for (const oneWordName of ["Solveig", "Cher", "Li", "Jo", "Saoirse", "Jean-Luc"]) {
  assert.equal(
    Parsing.isMeaningfulVisitorName(oneWordName),
    true,
    `${oneWordName} is a legitimate single-word visitor name`,
  );
}
// A single token still has to be a NAME. These are the shapes that arrive in the
// same slot and are not one.
for (const notAName of [
  "test", "visitor", "guest", "unknown", "n/a", "none", "idk", "hello",
  "asdf", "qwerty", "xyz", "name", "email", "phone", "four", "ready", "here",
]) {
  assert.equal(
    Parsing.isMeaningfulVisitorName(notAName),
    false,
    `"${notAName}" is not a visitor name, one token or four`,
  );
  const blocked = await captureWithName(notAName);
  assert.equal(blocked.notifyCalls.length, 0, `"${notAName}" must remain in the name gather step`);
}

console.log("iScott meaningful visitor-name check OK.");
