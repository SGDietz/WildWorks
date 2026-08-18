import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const statePath = path.join(repo, ".codex-qa", "wildworks-telemetry-monitor-state.json");
for (const line of fs.readFileSync(path.join(repo, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Supabase monitor configuration is missing");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rows(table, select, filter, order) {
  const url = `${base}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}&order=${order}&limit=200`;
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`${table}:${response.status}:${await response.text()}`);
  return response.json();
}

function isMeaningfulMessage(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length < 12 || text.split(" ").filter(Boolean).length < 3) return false;
  return !/^(hi|hello|hey|test|testing|you there|are you there)[.!?\s]*$/i.test(text);
}

function readState() {
  try { return JSON.parse(fs.readFileSync(statePath, "utf8")); }
  catch { return { lastCheckedAt: new Date().toISOString() }; }
}

function writeState(value) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function poll() {
  const state = readState();
  const checkedAt = new Date().toISOString();
  const since = encodeURIComponent(state.lastCheckedAt);
  const [messages, leads, failures] = await Promise.all([
    rows("conversation_messages", "session_id,message,route,created_at", `traffic_class=eq.public&role=eq.user&created_at=gt.${since}`, "created_at.asc"),
    rows("iscott_leads", "session_id,full_name,location,project_need,submitted_at", `status=eq.submitted&traffic_class=eq.public&submitted_at=gt.${since}`, "submitted_at.asc"),
    rows("voice_email_outbox", "event_type,subject,last_error,updated_at", `status=eq.failed&updated_at=gt.${since}`, "updated_at.asc"),
  ]);
  const meaningfulMessages = messages.filter((row) => isMeaningfulMessage(row.message));
  writeState({ ...state, lastCheckedAt: checkedAt });
  const result = {
    ok: true,
    period: { since: state.lastCheckedAt, through: checkedAt },
    actionable: meaningfulMessages.length + leads.length + failures.length,
    publicMessages: meaningfulMessages.map((row) => ({
      at: row.created_at,
      route: row.route,
      session: row.session_id,
      excerpt: String(row.message || "").replace(/\s+/g, " ").trim().slice(0, 220),
    })),
    submittedLeads: leads.map((row) => ({
      at: row.submitted_at,
      name: row.full_name || "Name not provided",
      location: row.location,
      project: String(row.project_need || "").slice(0, 240),
      session: row.session_id,
    })),
    failedNotifications: failures,
  };
  console.log(JSON.stringify(result, null, 2));
}

async function digest() {
  const secret = process.env.WILDWORKS_VOICE_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error("Telemetry digest authorization secret is missing");
  const endpoint = process.env.WILDWORKS_MONITOR_BASE_URL || "https://mission-control.tail00dfe0.ts.net:8443";
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/internal/telemetry-digest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`telemetry_digest:${response.status}:${body.error || body.detail || "failed"}`);
  console.log(JSON.stringify({ ok: true, status: response.status, delivered: body.delivered, deduplicated: body.deduplicated }, null, 2));
}

async function heartbeat() {
  const state = readState();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  const easternDate = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const pollResult = await (async () => {
    const original = console.log;
    let output = "";
    console.log = (value) => { output += String(value); };
    try { await poll(); } finally { console.log = original; }
    return JSON.parse(output);
  })();
  let digestResult = null;
  if (minutes >= 8 * 60 + 30 && state.lastDigestDate !== easternDate) {
    const original = console.log;
    let output = "";
    console.log = (value) => { output += String(value); };
    try { await digest(); } finally { console.log = original; }
    digestResult = JSON.parse(output);
    writeState({ ...readState(), lastDigestDate: easternDate });
  }
  console.log(JSON.stringify({ ...pollResult, digest: digestResult }, null, 2));
}

const mode = process.argv[2] || "poll";
if (mode === "poll") await poll();
else if (mode === "digest") await digest();
else if (mode === "heartbeat") await heartbeat();
else if (mode === "initialize") {
  const state = { lastCheckedAt: new Date().toISOString() };
  writeState(state);
  console.log(JSON.stringify({ ok: true, initializedAt: state.lastCheckedAt }));
} else throw new Error(`Unknown mode: ${mode}`);
