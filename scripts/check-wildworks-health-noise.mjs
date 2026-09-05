import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const out = path.resolve(".next/health-noise-test");
await fs.mkdir(out, { recursive: true });
const write = (name, text) => fs.writeFile(path.join(out, name + ".mjs"), text);
const url = (name) => pathToFileURL(path.join(out, name + ".mjs")).href;
async function compile(file, name, rewrites = []) {
  let source = ts.transpileModule(await fs.readFile(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  await write(name, source);
}
await compile("src/lib/wildworksHealthNoticePolicy.ts", "policy");
await compile("src/lib/codexOperationsHealth.ts", "operator-health");
await write("authorization", "export function authorizeVoiceEmailDrainRequest() { return true; }");
await write("supabase", 'export function isSupabaseAdminConfigured(){return true;} export function getSupabaseAdminConfig(){return {url:"https://database.invalid",serviceRoleKey:"test-only"};}');
await write("alerts", 'export const sends=[]; export let fail=false; export function failOne(){fail=true;} export async function sendWildWorksOperationalAlert(value){sends.push(value);if(fail){fail=false;return {sent:false};}return {sent:true};}');
await write("telemetry", "export const events=[]; export async function logServerTelemetryEvent({request,...value}){events.push(structuredClone(value));}");
await write("secrets", 'export const API_KEY="test-only", API_URL="https://avatar.invalid", AVATAR_ID="avatar", CONTEXT_ID="context", VOICE_ID="voice";');
await compile("app/api/cron/health/route.ts", "route", [
  ['@/src/lib/voiceCronAuthorization', './authorization.mjs'],
  ['@/src/lib/supabaseAdmin', './supabase.mjs'],
  ['@/src/lib/wildworksOperationalAlerts', './alerts.mjs'],
  ['@/src/lib/serverTelemetryCapture', './telemetry.mjs'],
  ['@/src/lib/wildworksHealthNoticePolicy', './policy.mjs'],
  ['@/src/lib/codexOperationsHealth', './operator-health.mjs'],
  ['@/app/api/liveavatar/secrets', './secrets.mjs'],
]);
const Alerts = await import(url("alerts")), Telemetry = await import(url("telemetry"));
const { nextHealthNotice } = await import(url("policy"));
const originalFetch = globalThis.fetch, originalNow = Date.now;
let now = Date.parse("2026-09-05T12:00:00Z"), publicDrift = 0, queryCount = 0, instance = 0;
Date.now = () => now;
globalThis.fetch = async (target) => {
  const u = new URL(target);
  if (u.hostname === "avatar.invalid") return Response.json({ data: { id: u.pathname.split("/").at(-1) } });
  assert.equal(u.hostname, "database.invalid", "no external traffic");
  if (u.pathname.endsWith("/app_events")) {
    assert.equal(u.searchParams.get("payload->>health_environment"), "eq.local");
    const payload = Telemetry.events.at(-1)?.payload;
    return Response.json(payload ? [{ payload }] : []);
  }
  let count = 0;
  if (u.pathname.endsWith("/iscott_leads")) {
    queryCount++;
    assert.equal(u.searchParams.get("or"), "(traffic_class.is.null,traffic_class.in.(public,owner))",
      "all submitted-lead health checks exclude held tests without hiding owner/customer traffic");
    if (u.searchParams.get("notification_status") === "neq.sent") count = publicDrift;
  } else if (u.pathname.endsWith("/visitor_sessions")) count = 10;
  else assert.ok(u.pathname.endsWith("/voice_email_outbox"));
  return new Response("[]", { headers: { "content-range": `0-0/${count}` } });
};
async function check(daily = false) {
  // Every invocation is a cold module, matching a serverless cron restart.
  const route = await import(url("route") + "?instance=" + instance++);
  return (await route.GET(new Request("https://local.invalid/api/cron/health" + (daily ? "?daily=1" : "")))).json();
}
try {
  assert.equal((await check()).healthy, true);
  assert.equal(Alerts.sends.length, 0, "old held test rows do not page the owner");
  await check(true); assert.equal(Alerts.sends.length, 0);
  await check(true); assert.equal(Alerts.sends.length, 0, "healthy stays silent, including old daily URLs");
  publicDrift = 1; now += 15 * 60_000;
  assert.equal((await check()).healthy, false); assert.equal(Alerts.sends.length, 1, "new customer delivery failure alerts immediately");
  for (let tick = 0; tick < 95; tick++) { now += 15 * 60_000; await check(); }
  assert.equal(Alerts.sends.length, 1, "95 unchanged 15-minute checks do not generate 95 Telegram alerts");
  now += 15 * 60_000; await check(); assert.equal(Alerts.sends.length, 2, "one reminder after 24 hours");
  publicDrift = 2; now += 15 * 60_000; await check(); assert.equal(Alerts.sends.length, 3, "changed delivery count alerts immediately");
  publicDrift = 0; now += 15 * 60_000; await check(); assert.equal(Alerts.sends.length, 3);
  await check(); assert.equal(Alerts.sends.length, 3, "recovery stays silent");
  publicDrift = 1; Alerts.failOne(); now += 15 * 60_000; await check(); const beforeRetry = Alerts.sends.length;
  now += 15 * 60_000; await check(); assert.equal(Alerts.sends.length, beforeRetry + 1, "failed Telegram send does not advance persisted notice");
  assert.ok(queryCount >= 300);
  assert.equal(nextHealthNotice({ findings: ["a", "b"], daily: false,
    previous: { fingerprint: JSON.stringify(["a", "b"]), at: new Date(now).toISOString(), healthy: false }, now: now + 1 }), null);
  console.log("Health noise replay passed: held-test exclusion, cold starts, unchanged incident suppression, daily reminder, new failures, recovery and send retry. No external calls.");
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }

// Exercise the real Telegram admission and response handling with a fake
// network. Correlation IDs may differ for two visitors with the same failure.
await fs.copyFile("src/lib/wildworksOperationalAlertPolicy.mjs", path.join(out, "wildworksOperationalAlertPolicy.mjs"));
await compile("src/lib/wildworksOperationalAlerts.ts", "real-alerts", [['import "server-only";', '']]);
const savedToken = process.env.TELEGRAM_ALERT_BOT_TOKEN, savedChat = process.env.TELEGRAM_ALERT_CHAT_ID;
process.env.TELEGRAM_ALERT_BOT_TOKEN = "123456:" + "x".repeat(35);
process.env.TELEGRAM_ALERT_CHAT_ID = "1234567";
let telegramAttempts = 0, rejectNext = false;
globalThis.fetch = async (target, init) => {
  assert.equal(new URL(target).hostname, "api.telegram.org"); assert.equal(init.method, "POST");
  telegramAttempts++;
  const ok = !rejectNext; rejectNext = false;
  return Response.json({ ok });
};
try {
  const { sendWildWorksOperationalAlert: send } = await import(url("real-alerts"));
  const alert = { category: "security", component: "origin guard", route: "/api/token",
    severity: "critical", summary: "origin rejected HTTP 403", correlationId: "visitor-one" };
  assert.equal((await send(alert)).sent, true);
  assert.equal((await send({ ...alert, correlationId: "visitor-two" })).reason, "suppressed");
  assert.equal(telegramAttempts, 1);
  rejectNext = true;
  const other = { ...alert, summary: "unrelated provider outage HTTP 503" };
  assert.equal((await send(other)).reason, "telegram_rejected");
  assert.equal((await send(other)).sent, true, "rejected response does not lock out the retry");
  assert.equal(telegramAttempts, 3);
  console.log("Actual Telegram dispatcher passed: same incident across visitors suppressed, new incident retained, API rejection retried. Network faked.");
} finally {
  globalThis.fetch = originalFetch;
  if (savedToken === undefined) delete process.env.TELEGRAM_ALERT_BOT_TOKEN; else process.env.TELEGRAM_ALERT_BOT_TOKEN = savedToken;
  if (savedChat === undefined) delete process.env.TELEGRAM_ALERT_CHAT_ID; else process.env.TELEGRAM_ALERT_CHAT_ID = savedChat;
}
