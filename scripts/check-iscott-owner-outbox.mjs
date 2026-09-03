// Real notifier/outbox contract for a second, materially changed verified
// contact in one iScott session. All persistence and provider calls are local
// in-memory fakes; the production notifier and enqueue/claim/dedupe code run.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-owner-outbox-test");
await fs.mkdir(out, { recursive: true });
const moduleUrl = (name) =>
  `file:///${path.join(out, `${name}.mjs`).split(path.sep).join("/")}`;

async function write(name, source) {
  await fs.writeFile(path.join(out, `${name}.mjs`), source, "utf8");
}

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
await transpile("src/lib/iscottVisitorConfirmation.ts", "iscottVisitorConfirmation", [
  ['from "./emailTheme"', 'from "./stub-theme.mjs"'], // CLAUDE 2026-09-02 (H443): the receipt now imports the theme; stub it like the notifications module

  ['from "./iscottLeadParsing"', 'from "./iscottLeadParsing.mjs"'],
]);

await write("stub-resend", `export const sendCalls = [];
export class Resend {
  constructor() {
    this.emails = { send: async (message, options) => {
      sendCalls.push({ message, options });
      await Promise.resolve();
      return { data: { id: "provider-" + sendCalls.length }, error: null };
    } };
  }
}
`);
await write("stub-security", `export function truncateUtf8String(value, limit) {
  return String(value ?? "").slice(0, limit);
}
`);
await write("stub-supabase", `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() {
  return { url: "https://local-outbox.invalid", serviceRoleKey: "local-test-key" };
}
`);
await write("stub-alerts", "export function queueSupabaseOperationalAlert() {}\n");
await write("stub-telemetry", `export function safeJsonPayload(value) { return value ?? {}; }
`);
await write("stub-policy", `export const VOICE_EMAIL_OUTBOX_STALE_MS = 300000;
export function isVoiceEmailOutboxRowDue(row) {
  return row.status === "pending" || row.status === "failed";
}
export function voiceEmailConfigurationFailurePatch() { return { status: "failed" }; }
export function voiceEmailRetryDelayMs() { return 1000; }
`);
await write("stub-notification-ids", `export const voiceLeadEmailIdempotencyKey = (id) => "voice-lead:" + id;
export const voicemailEmailIdempotencyKey = (id) => "voicemail:" + id;
`);
await write("stub-timeouts", `export function voiceBackendSignal() { return undefined; }
`);
await write("stub-identity", `export function wildWorksSenderConfigurationError() { return null; }
`);
await write("stub-theme", `export const THEME = { pageBg: "#fff", text1: "#111", text2: "#222", text3: "#333" };
export const emailShell = ({ bodyHtml }) => bodyHtml;
export const emailSubheading = (value) => value;
export const emailCallout = ({ html }) => html;
export const emailRows = (rows) => JSON.stringify(rows);
export const emailButton = (url, label) => label + ":" + url;
export const emailPre = (value) => value;
export const emailParagraph = (html) => html;
export const escapeHtml = (value) => String(value);
// CLAUDE 2026-09-02 (H433): the real theme grew these helpers; the stub must export them too.
export const emailSection = ({ html }) => html;
export const emailPaintedCopy = (value) => value;
export const emailMailto = (address) => address;
export const emailLink = (href, label) => label + ":" + href;
`);

await transpile("src/lib/voiceEmailNotifications.ts", "voiceEmailNotifications", [
  ['from "resend"', 'from "./stub-resend.mjs"'],
  ['from "./apiRouteSecurity"', 'from "./stub-security.mjs"'],
  ['from "./iscottLeadParsing"', 'from "./iscottLeadParsing.mjs"'],
  ['from "./supabaseAdmin"', 'from "./stub-supabase.mjs"'],
  ['from "./wildworksOperationalAlerts"', 'from "./stub-alerts.mjs"'],
  ['from "./telemetryServer"', 'from "./stub-telemetry.mjs"'],
  ['from "./voiceEmailOutboxPolicy"', 'from "./stub-policy.mjs"'],
  ['from "./voiceNotificationIds"', 'from "./stub-notification-ids.mjs"'],
  ['from "./voiceFetchTimeouts"', 'from "./stub-timeouts.mjs"'],
  ['from "./wildworksEmailIdentity.mjs"', 'from "./stub-identity.mjs"'],
  ['from "./emailTheme"', 'from "./stub-theme.mjs"'],
  ['from "./iscottVisitorConfirmation"', 'from "./iscottVisitorConfirmation.mjs"'],
]);

const rows = [];
const requests = [];
let nextId = 1;
const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

function queryValue(resource, name) {
  const match = resource.match(new RegExp(`(?:[?&])${name}=eq\\.([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function queryLikeValue(resource, name) {
  const match = resource.match(new RegExp(`(?:[?&])${name}=like\\.([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function publicRow(body) {
  return {
    id: `outbox-${nextId++}`,
    idempotency_key: body.idempotency_key,
    event_type: body.event_type,
    session_id: body.session_id ?? null,
    external_call_id: body.external_call_id ?? null,
    recipient: body.recipient ?? null,
    subject: body.subject,
    text_body: body.text_body,
    html_body: body.html_body ?? null,
    status: "pending",
    attempt_count: 0,
    provider_message_id: null,
    updated_at: new Date().toISOString(),
    lease_token: null,
    lease_expires_at: null,
    next_attempt_at: body.next_attempt_at ?? null,
    last_attempt_at: null,
  };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (target, init = {}) => {
  const resource = String(target).split("/rest/v1/")[1] ?? String(target);
  const method = init.method ?? "GET";
  requests.push({ resource, method });
  if (resource.startsWith("iscott_leads")) return response(200, []);
  if (!resource.startsWith("voice_email_outbox")) return response(200, []);

  if (method === "POST") {
    const body = JSON.parse(init.body);
    if (rows.some((row) => row.idempotency_key === body.idempotency_key)) {
      return response(409, "duplicate idempotency key");
    }
    const row = publicRow(body);
    rows.push(row);
    return response(201, [{ ...row }]);
  }

  if (method === "GET") {
    const key = queryValue(resource, "idempotency_key");
    return response(200, rows.filter((row) => !key || row.idempotency_key === key).map((row) => ({ ...row })));
  }

  if (method === "PATCH") {
    const id = queryValue(resource, "id");
    const sessionId = queryValue(resource, "session_id");
    const subjectLike = queryLikeValue(resource, "subject");
    const expectedStatus = queryValue(resource, "status");
    const expectedUpdatedAt = queryValue(resource, "updated_at");
    const expectedLease = queryValue(resource, "lease_token");
    const prefix = subjectLike?.endsWith("*") ? subjectLike.slice(0, -1) : subjectLike;
    const matching = rows.filter((candidate) =>
      (!id || candidate.id === id) &&
      (!sessionId || candidate.session_id === sessionId) &&
      (!prefix || String(candidate.subject ?? "").startsWith(prefix)) &&
      (!expectedStatus || candidate.status === expectedStatus) &&
      (!expectedUpdatedAt || candidate.updated_at === expectedUpdatedAt) &&
      (!expectedLease || candidate.lease_token === expectedLease)
    );
    if (!matching.length) {
      return response(200, []);
    }
    const patch = JSON.parse(init.body);
    matching.forEach((row) => Object.assign(row, patch));
    return response(200, matching.map((row) => ({ ...row })));
  }

  return response(405, "unsupported local test operation");
};

const oldEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  WILDWORKS_LEAD_NOTIFY_EMAIL: process.env.WILDWORKS_LEAD_NOTIFY_EMAIL,
};
process.env.RESEND_API_KEY = "local-test-only";
process.env.RESEND_FROM_EMAIL = "WildWorks <notify@example.com>";
process.env.WILDWORKS_LEAD_NOTIFY_EMAIL = "owner@example.com";

try {
  const Notifications = await import(moduleUrl("voiceEmailNotifications"));
  const Provider = await import(moduleUrl("stub-resend"));
  const base = {
    eventId: "same-session",
    sessionId: "same-session",
    fullName: "Sample Visitor",
    location: "Northlake",
    projectNeed: "A pool and a waterfall",
    contactMethod: "email",
    email: "Visitor@Example.com",
    receivedAt: "2026-08-29T14:00:00.000Z",
    transcript: "Initial verified package",
  };

  const first = await Notifications.notifyIScottLeadByEmail(base);
  assert.equal(first.delivered, true);
  assert.equal(rows.length, 1);
  assert.equal(Provider.sendCalls.length, 1);
  const firstRow = { ...rows[0] };
  assert.match(firstRow.idempotency_key, /^iscott-lead-package:[a-f0-9]{64}$/);
  assert.doesNotMatch(firstRow.idempotency_key, /visitor|example|same-session|@/i,
    "the durable idempotency key must not expose contact or session text");

  // Same normalized mailbox, but a regenerated timestamp/transcript/body. It
  // is still the same owner package and must reuse the original outbox row.
  const equivalent = await Notifications.notifyIScottLeadByEmail({
    ...base,
    email: " visitor@example.COM ",
    receivedAt: "2026-08-29T14:02:00.000Z",
    transcript: "Longer retry transcript that changes the email body",
  });
  assert.equal(equivalent.deduplicated, true);
  assert.equal(equivalent.outboxId, first.outboxId);
  assert.equal(rows.length, 1);
  assert.equal(Provider.sendCalls.length, 1);

  // A newly verified mailbox in the same session is a new package. The old row
  // remains untouched and auditable, while the new package sends exactly once.
  const changed = await Notifications.notifyIScottLeadByEmail({
    ...base,
    email: "different@example.com",
    receivedAt: "2026-08-29T14:05:00.000Z",
    transcript: "Fresh exact readback and permission for changed contact",
  });
  assert.equal(changed.delivered, true);
  assert.notEqual(changed.outboxId, first.outboxId);
  assert.equal(rows.length, 2);
  assert.equal(Provider.sendCalls.length, 2);
  assert.notEqual(rows[0].idempotency_key, rows[1].idempotency_key);
  assert.equal(rows[0].id, firstRow.id);
  assert.equal(rows[0].text_body, firstRow.text_body,
    "a later contact package must not overwrite the prior audit row");

  // Two concurrent retries of one normalized phone package race through the
  // actual POST-conflict/find/claim path. The unique key plus lease CAS permits
  // exactly one provider call and returns the same durable outbox row to both.
  const sendsBeforePhone = Provider.sendCalls.length;
  const phoneBase = {
    ...base,
    eventId: "concurrent-phone-session",
    sessionId: "concurrent-phone-session",
    contactMethod: "phone",
    email: null,
    phone: "(443) 555-0142",
  };
  const [phoneA, phoneB] = await Promise.all([
    Notifications.notifyIScottLeadByEmail(phoneBase),
    Notifications.notifyIScottLeadByEmail({ ...phoneBase, phone: "+1 443-555-0142" }),
  ]);
  assert.equal(phoneA.outboxId, phoneB.outboxId);
  assert.equal(rows.filter((row) => row.session_id === phoneBase.sessionId).length, 1);
  assert.equal(Provider.sendCalls.length - sendsBeforePhone, 1);
  assert.ok(phoneA.deduplicated || phoneB.deduplicated,
    "one concurrent retry must be reported as deduplicated");

  // A recovery-only package stays parked even when reissued after an exact
  // read-back. Read-back confirms accuracy, not permission to transmit.
  const sendsBeforePartial = Provider.sendCalls.length;
  const partialBase = {
    ...base,
    eventId: "confirmed-partial-session#partial",
    sessionId: "confirmed-partial-session",
    fullName: null,
    projectNeed: null,
    email: "recoverable@example.com",
    partial: true,
  };
  const parked = await Notifications.notifyIScottPartialLeadByEmail(partialBase);
  assert.equal(parked.delivered, false);
  assert.equal(parked.outboxStatus, "pending");
  assert.equal(Provider.sendCalls.length, sendsBeforePartial);
  const partialRow = rows.find((row) => row.id === parked.outboxId);
  assert.ok(partialRow?.next_attempt_at, "unconfirmed partial must have a due time");

  const stillParked = await Notifications.notifyIScottPartialLeadByEmail(partialBase);
  assert.equal(stillParked.outboxId, parked.outboxId);
  assert.equal(stillParked.delivered, false);
  assert.equal(stillParked.outboxStatus, "pending");
  assert.equal(rows.filter((row) => row.session_id === partialBase.sessionId).length, 1);
  assert.equal(Provider.sendCalls.length, sendsBeforePartial);

  // The same conversation now finishes normally. Exactly one provider call is
  // allowed: the completed, permissioned package. The parked incomplete row
  // remains in the audit but is retired before the outbox drain can deliver it.
  const completed = await Notifications.notifyIScottLeadByEmail({
    ...partialBase,
    eventId: "confirmed-partial-session",
    fullName: "Example Visitor",
    projectNeed: "A landscape design",
    partial: false,
  });
  assert.equal(completed.delivered, true);
  assert.equal(completed.outboxStatus, "sent");
  assert.equal(Provider.sendCalls.length, sendsBeforePartial + 1,
    "a completed conversation sends exactly one owner email");
  assert.equal(rows.filter((row) => row.session_id === partialBase.sessionId).length, 2,
    "the audit retains one partial row and one completed row");
  assert.equal(partialRow.status, "dead_letter",
    "the completed package must retire the parked incomplete row");
  assert.equal(partialRow.last_error, "superseded_by_complete_lead");
  assert.equal(partialRow.next_attempt_at, null);

  assert.ok(requests.some(({ method }) => method === "POST"));
  assert.ok(requests.some(({ method, resource }) => method === "GET" && resource.includes("idempotency_key=eq.")));
  assert.ok(requests.some(({ method }) => method === "PATCH"));
  console.log("iScott package-scoped owner outbox check OK.");
} finally {
  globalThis.fetch = realFetch;
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
