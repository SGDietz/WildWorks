// THE PACKAGE, AND WHEN THE PERMISSION BELONGS TO IT. 2026-08-30.
//
// A visitor does not give permission to "a send". They authorize Scott to use
// one confirmed CONTACT about the project they described. A later or corrected
// name improves that owner package without changing the authorized contact.
// Changing the project intent or the contact still requires fresh permission.
//
// This file drives the REAL code for all of it: the real parsing library, the
// real capture pipeline, and the real confirm route handler. Supabase is an
// in-memory store behind a stubbed fetch and the notification service is a mock
// that RECORDS calls - a recorded call is local evidence that the code DECIDED
// to send, never evidence that any mail exists. Nothing here touches a network,
// a provider, a mailbox or a person, and every address and number is synthetic
// (example.com is reserved by RFC 2606; 555-01xx is reserved by RFC 3849's
// telephone equivalent and cannot route).
//
// SCOPE NOTE, kept deliberately: nothing in this file makes iScott SAY anything.
// nextIScottLeadQuestion and friends are local helpers that compute what the
// next missing step is; they are not wired to LiveAvatar speech and are not
// cited here as proof that iScott asks anything out loud. Spoken follow-up
// remains unimplemented.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next");
await fs.mkdir(out, { recursive: true });
const url = (name) => "file:///" + path.join(out, `pc-${name}.mjs`).split(path.sep).join("/");
const stub = (name, source) => fs.writeFile(path.join(out, `pc-${name}.mjs`), source, "utf8");
async function transpile(rel, rewrites = []) {
  const name = path.basename(rel).replace(/\.ts$/, "");
  let code = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) code = code.replaceAll(from, to);
  await fs.writeFile(path.join(out, `pc-${name}.mjs`), code, "utf8");
  return `./pc-${name}.mjs`;
}

const salesPath = await transpile("src/lib/iscottSalesCopy.ts");
await transpile("src/lib/iscottLeadParsing.ts", [['from "./iscottSalesCopy"', `from "${salesPath}"`]]);
const P = await import(url("iscottLeadParsing"));

const EMAIL = "visitor@example.com";
const OTHER_EMAIL = "someone.else@example.com";
const PHONE = "+1 (443) 555-0142";
const SAME_PHONE_SPOKEN = "443-555-0142";
const SESSION = "sess-package-chronology-20260830";

/* ------------------------------------------------------------------ *
 * A. WHAT COUNTS AS A CHANGE. Said again in a different shape is not a
 *    change; said differently on purpose is.
 * ------------------------------------------------------------------ */

// A1. Harmless case, spacing and punctuation are the same answer twice.
for (const [field, before, after] of [
  ["name", "Mary-Anne O'Neill", "  mary-anne o'neill  "],
  ["name", "Jennifer Mcallister", "JENNIFER MCALLISTER."],
  ["intent", "A pool and a waterfall out back", "a pool and a waterfall out back."],
  ["intent", "Help with a retaining wall by the driveway", "HELP WITH A RETAINING WALL, BY THE DRIVEWAY"],
]) {
  assert.equal(
    P.leadPackageFieldChanged(field, before, after),
    false,
    `"${before}" said again as "${after}" is not a change of ${field}`,
  );
}

// A2. Equivalent contact formatting is one way to reach one person.
assert.equal(P.leadPackageFieldChanged("contact", PHONE, SAME_PHONE_SPOKEN, "phone"), false);
assert.equal(P.leadPackageFieldChanged("contact", PHONE, "1-443-555-0142", "phone"), false);
assert.equal(P.leadPackageFieldChanged("contact", EMAIL, " Visitor@Example.COM ", "email"), false);
assert.equal(P.leadPackageFieldChanged("contact", EMAIL, OTHER_EMAIL, "email"), true);
assert.equal(P.leadPackageFieldChanged("contact", PHONE, "443-555-0199", "phone"), true);

// A3. Finishing an answer is not changing it. Changing it is.
assert.equal(P.leadPackageFieldChanged("name", "George", "George Smith"), false, "a fuller name is the same name");
assert.equal(P.leadPackageFieldChanged("name", "George", "Gregory"), true, "a different name is a different person");
assert.equal(
  P.leadPackageFieldChanged("intent", "A pool", "A pool and a waterfall out back"),
  false,
  "more of the same job is the same job",
);
assert.equal(
  P.leadPackageFieldChanged("intent", "A pool and a waterfall out back", "A retaining wall by the driveway"),
  true,
  "a different job is a different quote",
);

// A4. And the package-level summary names WHICH field moved.
assert.deepEqual(
  P.materialLeadPackageChanges(
    { fullName: "George Smith", projectNeed: "A pool out back", contactMethod: "email", contactValue: EMAIL },
    { fullName: "Gregory Vance", projectNeed: "A pool out back", contactMethod: "email", contactValue: " VISITOR@example.com " },
  ),
  ["name"],
);
assert.deepEqual(
  P.materialLeadPackageChanges(
    { fullName: "George Smith", projectNeed: "A pool out back", contactMethod: "email", contactValue: EMAIL },
    { fullName: "George Smith", projectNeed: "A pool out back", contactMethod: "phone", contactValue: PHONE },
  ),
  ["contact"],
  "switching method is a contact change",
);

// A5. Completeness, and what is missing when it is not complete.
assert.equal(
  P.isCompleteLeadPackage({
    fullName: "Cher",
    projectNeed: "A pool and a waterfall out back",
    contactMethod: "email",
    contactValue: EMAIL,
  }),
  true,
);
assert.deepEqual(
  P.missingLeadPackageFields({ fullName: "visitor", projectNeed: "I need some help", contactMethod: null, contactValue: null }),
  ["name", "intent", "contact"],
);

/* ------------------------------------------------------------------ *
 * B. A LEGITIMATE ONE-WORD NAME IS A NAME. What the gate refuses is
 *    values that are not names at all.
 * ------------------------------------------------------------------ */

for (const oneWord of ["Cher", "Solveig", "Li", "Jo", "Saoirse", "Jean-Luc", "O'Neill"]) {
  assert.equal(P.isMeaningfulVisitorName(oneWord), true, `"${oneWord}" is a name a visitor actually goes by`);
}
for (const notAName of [
  "test", "Testing", "visitor", "guest", "user", "unknown", "n/a", "none", "idk",
  "asdf", "qwerty", "xyz", "hello", "name", "email", "phone", "address",
  "My Email Address", "Best Time To Call", "four", "seven", "ready", "here",
  EMAIL, "(443) 555-0142", "four four three five five five zero one four two",
]) {
  assert.equal(P.isMeaningfulVisitorName(notAName), false, `"${notAName}" is not a visitor name`);
}

/* ------------------------------------------------------------------ *
 * C. CHRONOLOGY. Permission counts only if it was given after the last
 *    material change to every field of the package.
 * ------------------------------------------------------------------ */

const READBACK = { role: "assistant", message: `I have your email as ${EMAIL}. Did I get that right?`, laAbsoluteTimestamp: 16 };
const CONFIRM_READBACK = { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 };
const ASK = { role: "assistant", message: "May I send these details to Scott?", laAbsoluteTimestamp: 20 };
const YES = { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 };
const NAME_TURN = { role: "user", message: "My name is Jennifer Mcallister.", laAbsoluteTimestamp: 10 };
const PROJECT_TURN = { role: "user", message: "I want a pool and a waterfall out back.", laAbsoluteTimestamp: 12 };
const EMAIL_TURN = { role: "user", message: `My email is ${EMAIL}.`, laAbsoluteTimestamp: 14 };
const SETTLED = [NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES];

const chronology = (rows, over = {}) => P.evaluateLeadPackageChronology({
  rows,
  fullName: "Jennifer Mcallister",
  projectNeed: "A pool and a waterfall out back",
  contactMethod: "email",
  contactValue: EMAIL,
  ...over,
});

// C1. The settled ride. Permission arrives last and stands.
{
  const result = chronology(SETTLED);
  assert.equal(result.permissionCurrent, true, "a yes given after the whole package is permission for it");
  assert.deepEqual(result.staleFields, []);
  assert.equal(result.packageComplete, true);
}

// C2. Saying the same things again afterwards changes nothing.
{
  const result = chronology([
    ...SETTLED,
    { role: "user", message: "I'm Jennifer, by the way.", laAbsoluteTimestamp: 24 },
    { role: "user", message: `Just to be sure, my email is ${EMAIL.toUpperCase()}.`, laAbsoluteTimestamp: 26 },
  ]);
  assert.equal(result.permissionCurrent, true, "repeating the same answers is not a new package");
  assert.deepEqual(result.staleFields, []);
}

// C3. A later name improves the package without changing permission to use the
//     confirmed contact. A changed project intent still requires fresh consent.
{
  const result = chronology([...SETTLED, { role: "user", message: "Actually, my name is Gregory Vance.", laAbsoluteTimestamp: 24 }]);
  assert.deepEqual(result.staleFields, [], "a changed name is not consent-material");
  assert.equal(result.permissionCurrent, true, "permission still covers the confirmed contact");
}
{
  const result = chronology([...SETTLED, { role: "user", message: "Actually, I want a retaining wall by the driveway.", laAbsoluteTimestamp: 24 }]);
  assert.deepEqual(result.staleFields, ["intent"], "a changed intent is stale");
  assert.equal(result.permissionCurrent, false, "permission no longer covers the changed project package");
}

// C3b. A CHANGED CONTACT loses the permission outright rather than holding a
//      stale one: the read-back rule already refuses to let a yes be inherited
//      by an address the visitor has since changed. Asked from either side of
//      the change - the old address or the new one - there is no permission to
//      spend, and that is what the visitor is told.
{
  const changed = [...SETTLED, { role: "user", message: `Use ${OTHER_EMAIL} instead.`, laAbsoluteTimestamp: 24 }];
  for (const [label, contactValue] of [["the address that was agreed", EMAIL], ["the address now held", OTHER_EMAIL]]) {
    const result = chronology(changed, { contactValue });
    assert.equal(result.permissionIndex, null, `${label}: the old yes is not permission after the change`);
    assert.equal(result.permissionCurrent, false);
  }
}

// C4. No permission at all is not a stale permission. It is told as itself.
{
  const result = chronology([NAME_TURN, PROJECT_TURN, EMAIL_TURN]);
  assert.equal(result.permissionIndex, null);
  assert.deepEqual(result.staleFields, [], "nothing can go stale under a permission that was never given");
  assert.equal(result.permissionCurrent, false);
}

// C5. The gate reports the two states with two different blockers, so the
//     visitor is never told they changed something they did not.
{
  const base = {
    fullName: "Jennifer Mcallister",
    projectNeed: "A pool and a waterfall out back",
    contactMethod: "email",
    contactValue: EMAIL,
    consentStatus: "accepted",
    contactConfirmedAt: "2026-08-30T15:00:00.000Z",
  };
  assert.equal(P.evaluateIScottLeadSendQualification({ ...base, rows: SETTLED }).qualified, true);
  assert.deepEqual(
    P.evaluateIScottLeadSendQualification({
      ...base,
      rows: [...SETTLED, { role: "user", message: "Actually, my name is Gregory Vance.", laAbsoluteTimestamp: 24 }],
    }).blockers,
    [],
  );
  assert.deepEqual(
    P.evaluateIScottLeadSendQualification({ ...base, rows: [NAME_TURN, PROJECT_TURN, EMAIL_TURN] }).blockers,
    ["no_exact_contact_consent"],
  );
}

/* ------------------------------------------------------------------ *
 * D. THE REAL PIPELINE. In-memory Supabase, mocked notification service.
 * ------------------------------------------------------------------ */

await stub("stub-notify", `export const notifyCalls = [];
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(args);
  return { queued: true, delivered: true, outboxId: "outbox-local-stub", detail: "" };
}
`);
await stub("stub-supabase", `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() { return { url: "https://stub.supabase.co", serviceRoleKey: "stub-key" }; }
`);
await stub("stub-alerts", "export function queueSupabaseOperationalAlert() {}\n");
await stub("stub-security", `export function truncateUtf8String(value, limit) { return String(value ?? "").slice(0, limit); }
`);
await stub("stub-traffic", `export async function classifyTraffic() { return { trafficClass: "public", reason: "stub", confidence: 1 }; }
export function trafficColumns(t) { return { traffic_class: t.trafficClass, traffic_reason: t.reason, traffic_confidence: t.confidence }; }
`);
await stub("stub-resolve", `export const ISCOTT_TEST_HELD_STATUS = "test_held";
export function canDispatchIScottLeadNotification() { return true; }
`);
await stub("stub-ui", `export { visitorChoseContactMethod } from "./pc-iscottLeadParsing.mjs";
`);
// The visitor receipt ships disabled; this check is about the owner package.
await stub("stub-visitor-confirmation", `export const ISCOTT_VISITOR_CONFIRMATION_ENABLED = false;
export const ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS = "approval_required";
`);

await transpile("src/lib/iscottLeadCapture.ts", [
  ['from "./iscottLeadParsing"', 'from "./pc-iscottLeadParsing.mjs"'],
  ['from "./iscottVisitorConfirmation"', 'from "./pc-stub-visitor-confirmation.mjs"'],
  ['from "./iscottLeadCaptureUi"', 'from "./pc-stub-ui.mjs"'],
  ['from "./voiceEmailNotifications"', 'from "./pc-stub-notify.mjs"'],
  ['from "./supabaseAdmin"', 'from "./pc-stub-supabase.mjs"'],
  ['from "./wildworksOperationalAlerts"', 'from "./pc-stub-alerts.mjs"'],
  ['from "./apiRouteSecurity"', 'from "./pc-stub-security.mjs"'],
  ['from "./trafficClassification"', 'from "./pc-stub-traffic.mjs"'],
  ['from "./iscottTrafficResolve"', 'from "./pc-stub-resolve.mjs"'],
]);
const Capture = await import(url("iscottLeadCapture"));
const Notify = await import(url("stub-notify"));

function leadBackend(row, messages = []) {
  const store = { row: row ? { ...row } : null };
  const writes = [];
  const reply = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => "" });
  const fetchImpl = async (target, init = {}) => {
    const resource = String(target).split("/rest/v1/")[1] ?? String(target);
    if (resource.startsWith("iscott_leads")) {
      if ((init.method ?? "GET") === "POST") {
        const incoming = JSON.parse(init.body)[0];
        writes.push(incoming);
        store.row = { ...(store.row ?? {}), ...incoming };
        return reply([store.row]);
      }
      return reply(store.row ? [store.row] : []);
    }
    if (resource.startsWith("conversation_messages")) return reply(messages);
    return reply([]);
  };
  return { store, writes, fetchImpl };
}

const persisted = (rows) => rows.map((row) => ({
  role: row.role,
  message: row.message,
  la_absolute_timestamp: row.laAbsoluteTimestamp ?? null,
}));

const realFetch = globalThis.fetch;
async function withBackend(row, run, messages = []) {
  const backend = leadBackend(row, messages);
  Notify.notifyCalls.length = 0;
  globalThis.fetch = backend.fetchImpl;
  try {
    return { backend, result: await run(backend) };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const ride = (rows) => withBackend(null, () =>
  Capture.processIScottTranscriptRows({ sessionId: SESSION, route: "/pages/avatar-iscott", rows }));

// D1. A ONE-WORD NAME TRAVELS. Everything else about this ride is complete, so
//     the only question it asks is whether "Cher" is a name. It is.
{
  const { backend } = await ride([
    { role: "user", message: "My name is Cher.", laAbsoluteTimestamp: 10 },
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK,
    CONFIRM_READBACK,
    ASK,
    YES,
  ]);
  assert.equal(backend.store.row.full_name, "Cher");
  assert.equal(Notify.notifyCalls.length, 1, "a complete package with a one-word name reaches Scott");
}

// D2. THE SAME ANSWERS SAID AGAIN. A visitor who repeats their name and reads
//     their own address back in a different case has changed nothing, and must
//     not have their permission torn down - nor be sent to Scott twice.
{
  const { backend } = await ride([
    NAME_TURN,
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK,
    CONFIRM_READBACK,
    ASK,
    YES,
    { role: "user", message: "I'm Jennifer, by the way.", laAbsoluteTimestamp: 24 },
    { role: "user", message: `And that address is ${EMAIL.toUpperCase()}, yes.`, laAbsoluteTimestamp: 26 },
  ]);
  assert.equal(backend.store.row.consent_status, "accepted", "a re-spoken answer keeps the permission");
  assert.ok(backend.store.row.contact_confirmed_at, "and the contact confirmation");
  assert.equal(Notify.notifyCalls.length, 1, "and Scott is told once, not twice");
}

// D3. A MATERIAL CHANGE AFTER THE YES FAILS CLOSED. Zero notify, permission and
//     contact confirmation both cleared, and the capture keeps everything the
//     visitor gave so they can finish from where they are.
for (const [field, turn, expectation] of [
  ["intent", { role: "user", message: "Actually, I want a retaining wall by the driveway.", laAbsoluteTimestamp: 24 }, "a different job"],
  ["contact", { role: "user", message: `Use ${OTHER_EMAIL} instead.`, laAbsoluteTimestamp: 24 }, "a different address"],
]) {
  const { backend } = await ride([NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES, turn]);
  assert.equal(Notify.notifyCalls.length, 0, `${expectation} after the yes must not be sent to Scott`);
  assert.equal(backend.store.row.consent_status, "unknown", `the ${field} change invalidates the permission`);
  assert.equal(backend.store.row.contact_confirmed_at, null, "and the contact confirmation with it");
  assert.equal(backend.store.row.status, "ready_for_confirmation", "the lead stays in the capture flow");
  assert.ok(backend.store.row.email, "and the capture keeps the contact on screen and editable");
  assert.ok(backend.store.row.full_name, "and the name");
  assert.ok(backend.store.row.project_need, "and the job");
}

// D3a. A late or corrected name is package information, not a change to the
// visitor's permission to use the confirmed contact.
{
  const { backend } = await ride([
    NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES,
    { role: "assistant", message: "What is your name?", laAbsoluteTimestamp: 23 },
    { role: "user", message: "Actually, my name is Gregory Vance.", laAbsoluteTimestamp: 24 },
  ]);
  assert.equal(backend.store.row.full_name, "Gregory Vance", "the owner package uses the corrected name");
  assert.equal(backend.store.row.consent_status, "accepted", "the corrected name keeps contact permission");
  assert.ok(backend.store.row.contact_confirmed_at, "the confirmed contact stays confirmed");
  assert.equal(Notify.notifyCalls.length, 1, "the corrected-name package reaches Scott exactly once");
}

// D4. AND A FRESH CONFIRMATION OF THE CHANGED PACKAGE TRAVELS. The visitor
//     changed their name, iScott read the address back again, asked again, and
//     they said yes again. That is permission for the package as it stands.
{
  const { backend } = await ride([
    NAME_TURN,
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK,
    CONFIRM_READBACK,
    ASK,
    YES,
    { role: "user", message: "Actually, my name is Gregory Vance.", laAbsoluteTimestamp: 24 },
    { ...READBACK, laAbsoluteTimestamp: 26 },
    { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 28 },
    { ...ASK, laAbsoluteTimestamp: 30 },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: 32 },
  ]);
  assert.equal(backend.store.row.full_name, "Gregory Vance", "the lead holds the name the visitor ended on");
  assert.equal(backend.store.row.consent_status, "accepted", "the second yes is permission for the second package");
  assert.equal(Notify.notifyCalls.length, 1, "and that package goes, exactly once");
}

// D4b. A JOB NOBODY CAN QUOTE STILL GOES. G, 2026-09-02 16:47 ET chose (a): "Send anyway. Email says project need: not stated yet." His word, verbatim: "a".
//      A vague need is not a missing package: consent + confirmed contact sends,
//      Scott's email says "Project: not stated yet".
{
  const { backend } = await ride([
    NAME_TURN,
    { role: "user", message: "I need some help with a project.", laAbsoluteTimestamp: 12 },
    EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES,
  ]);
  assert.equal(Notify.notifyCalls.length, 1, "a vague need reaches Scott (G: a)");
  assert.equal(backend.store.row.status, "submitted");
}

// D5. INCOMPLETE PACKAGES FAIL CLOSED TOO - zero notify, everything kept.
for (const [label, rows] of [
  ["no name at all", [PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES]],
  ["a placeholder name", [
    { role: "user", message: "My name is Test.", laAbsoluteTimestamp: 10 },
    PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES,
  ]],
  ["no contact", [NAME_TURN, PROJECT_TURN]],
]) {
  const { backend } = await ride(rows);
  assert.equal(Notify.notifyCalls.length, 0, `${label}: an incomplete package never reaches Scott`);
  assert.notEqual(backend.store.row.status, "submitted", `${label}: and is never marked submitted`);
  assert.equal(backend.store.row.submitted_at ?? null, null, `${label}: with no submission timestamp`);
}

/* ------------------------------------------------------------------ *
 * E. THE CONFIRM ROUTE, driven end to end through the REAL handler and
 *    the REAL capture pipeline. This is the stale DIRECT confirm: a
 *    caller POSTing at a row whose package moved after its permission.
 * ------------------------------------------------------------------ */

await stub("stub-route-security", `export function assertAllowedOrigin() { return null; }
export function isSafeTranscriptionSessionId(id) { return typeof id === "string" && /^[A-Za-z0-9_-]{4,120}$/.test(id); }
`);
await stub("stub-route-rate", "export async function checkRateLimit() { return null; }\n");
await stub("stub-route-telemetry", `export const telemetry = [];
export async function logServerTelemetryEvent(event) { telemetry.push(event); }
export async function logIScottOriginRejection() {}
`);
await transpile("app/api/iscott/lead/confirm/route.ts", [
  ['from "../../../../../src/lib/apiRouteSecurity"', 'from "./pc-stub-route-security.mjs"'],
  ['from "../../../../../src/lib/iscottLeadCapture"', 'from "./pc-iscottLeadCapture.mjs"'],
  ['from "../../../../../src/lib/iscottLeadParsing"', 'from "./pc-iscottLeadParsing.mjs"'],
  ['from "../../../../../src/lib/rateLimit"', 'from "./pc-stub-route-rate.mjs"'],
  ['from "../../../../../src/lib/serverTelemetryCapture"', 'from "./pc-stub-route-telemetry.mjs"'],
  ['from "../../../../../src/lib/iscottOriginTelemetry"', 'from "./pc-stub-route-telemetry.mjs"'],
]);
const Route = await import(url("route"));

const postConfirm = () => Route.POST(new Request("https://wildworks.ai/api/iscott/lead/confirm", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
}));

const PERMISSIONED_ROW = {
  session_id: SESSION,
  anonymous_visitor_id: null,
  source_route: "/pages/avatar-iscott",
  status: "ready_for_confirmation",
  consent_status: "accepted",
  full_name: "Jennifer Mcallister",
  location: "Northlake",
  project_need: "A pool and a waterfall out back",
  contact_method: "email",
  email: EMAIL,
  phone: null,
  contact_confirmed_at: "2026-08-30T15:00:00.000Z",
  submitted_at: null,
  notification_outbox_id: null,
  notification_status: null,
  traffic_class: "public",
  traffic_reason: "stub",
  traffic_confidence: 1,
  transcript_text: "",
  transcript_snapshot: [],
  media_snapshot: [],
  metadata: {},
  created_at: "2026-08-30T14:00:00.000Z",
  updated_at: "2026-08-30T15:00:00.000Z",
};

const INTENT_CHANGE = { role: "user", message: "Actually, I want a retaining wall by the driveway.", laAbsoluteTimestamp: 24 };

// E1. THE STALE DIRECT CONFIRM. The row's own columns still say "accepted" -
//     they are a conclusion the pipeline reached before the package moved. The
//     conversation is read here, ahead of any write, and the package it proves
//     permission for is not the package this call would send.
{
  const { backend } = await withBackend(
    PERMISSIONED_ROW,
    async () => {
      const response = await postConfirm();
      const body = await response.json();
      assert.equal(response.status, 409, "a package that moved under its permission is a 409, not a 500");
      assert.equal(body.ok, false);
      assert.match(body.error, /Nothing has been sent/, "and the visitor is told plainly that nothing went");
      assert.match(body.error, /changed after you gave permission/i, "named as what it is");
      assert.match(body.error, /read the new details back|say yes/i, "with the new confirmation it needs");
      assert.doesNotMatch(body.error, /error|invalid|failed|sorry/i, "and never as the visitor's fault");
      return body;
    },
    persisted([...[NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES], INTENT_CHANGE]),
  );
  assert.equal(Notify.notifyCalls.length, 0, "a stale package never reaches the notification service");
  assert.equal(backend.writes.length, 0, "and nothing is written on the way to refusing it");
  assert.equal(backend.store.row.status, "ready_for_confirmation", "the row is left exactly where it was");
  assert.equal(backend.store.row.email, EMAIL, "with the visitor's details still on it");
}

// E2. THE SAME CALL AFTER A FRESH CONFIRMATION GOES. Nothing about the request
//     changed - only the conversation behind it.
{
  const { backend } = await withBackend(
    PERMISSIONED_ROW,
    async () => {
      const response = await postConfirm();
      assert.equal(response.status, 200, "a re-confirmed package is accepted");
      return response.json();
    },
    persisted([
      NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES,
      INTENT_CHANGE,
      { ...READBACK, laAbsoluteTimestamp: 26 },
      { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 28 },
      { ...ASK, laAbsoluteTimestamp: 30 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 32 },
    ]),
  );
  assert.equal(Notify.notifyCalls.length, 1, "the re-confirmed package is handed over exactly once");
  assert.equal(Notify.notifyCalls[0].email, EMAIL, "carrying the address that was read back");
  assert.equal(backend.store.row.status, "submitted");
}

// E3. A re-spoken answer in a different shape is not a changed package, and a
//     direct confirm on it is still allowed through.
{
  await withBackend(
    PERMISSIONED_ROW,
    async () => {
      const response = await postConfirm();
      assert.equal(response.status, 200, "normalization-equivalent repeats do not block a confirm");
    },
    persisted([
      NAME_TURN, PROJECT_TURN, EMAIL_TURN, READBACK, CONFIRM_READBACK, ASK, YES,
      { role: "user", message: "I'm Jennifer, by the way.", laAbsoluteTimestamp: 24 },
      { role: "user", message: `And that is ${EMAIL.toUpperCase()}.`, laAbsoluteTimestamp: 26 },
    ]),
  );
  assert.equal(Notify.notifyCalls.length, 1);
}

/* ------------------------------------------------------------------ *
 * F. NO OPTIMISTIC SEND CLAIMS ANYWHERE ON THE WAY.
 * ------------------------------------------------------------------ */

const routeSource = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
const confirmBlock = routeSource.slice(
  routeSource.indexOf("const confirmLead ="),
  routeSource.indexOf("const showLead ="),
);
const beforeFetch = confirmBlock.slice(0, confirmBlock.indexOf("await fetch("));

// F1. Nothing painted before the request even leaves claims a send.
assert.match(
  beforeFetch,
  /status\.textContent = "Checking your details\. Nothing has been sent to Scott yet\.";/,
  "the pre-send line checks the details and says nothing has gone",
);
assert.doesNotMatch(beforeFetch, /status\.textContent = "I'm sending that to Scott\.";/,
  "the optimistic pre-send claim has not crept back");
// Matched as a STATEMENT, not as text: the comment above this line in the page
// quotes the call it replaced, and a check that cannot tell code from the note
// explaining it is a check that fails on honesty.
assert.doesNotMatch(beforeFetch, /^\s*setCaptureHidden\(true\);/m, "and the capture is not taken away on optimism");
assert.doesNotMatch(beforeFetch, /data-box-view", "(?:sent|submitted)"/, "nor any success view");

// F2. The library copy says the same thing, and cannot claim a send is under way.
assert.equal(P.checkingDetailsStatusCopy(), "Checking your details. Nothing has been sent to Scott yet.");
assert.equal(P.confirmingHandoffStatusCopy(), P.checkingDetailsStatusCopy());
for (const copy of [P.checkingDetailsStatusCopy(), P.changedPackageStatusCopy()]) {
  assert.doesNotMatch(copy, /\bsending\b/i, `pre-send copy must not claim a send: ${copy}`);
  assert.match(copy, /nothing has been sent/i, `pre-send copy must say nothing has been sent: ${copy}`);
}
assert.match(P.changedPackageStatusCopy(), /say yes/i, "the changed-package line asks for a new confirmation");

// F3. And the panel still keeps the box, the value and the Send control behind a
//     refusal, so the visitor can finish the missing step from where they are.
assert.match(confirmBlock, /catch \(error\) \{[\s\S]{0,400}setCaptureHidden\(false\)/, "a refused send keeps the capture box");
assert.match(confirmBlock, /catch \(error\) \{[\s\S]{0,600}button\.disabled = false/, "and Send comes back");

// F4. THE HONEST LIMIT OF THIS FILE. The gather-question helpers are local
//     computation. They are not wired to the avatar's speech and nothing here
//     claims they make iScott say anything - spoken follow-up is unimplemented.
assert.doesNotMatch(routeSource, /nextIScottLeadQuestion/, "no test-only question helper is wired into the page");
assert.doesNotMatch(routeSource, /iscottLeadGatherOrder/, "nor the gather order");

console.log("iScott package-chronology check OK - late names keep contact consent; changed intent/contact and incomplete leads still fail closed.");
