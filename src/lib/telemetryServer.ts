import { truncateUtf8String } from "./apiRouteSecurity";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";

const MAX_JSON_CHARS = 12000;
const FALLBACK_MESSAGE_CHARS = 3900;
const RAW_TELEMETRY_BUCKET = process.env.SUPABASE_TELEMETRY_BUCKET || "wildworks-telemetry";
const RAW_TELEMETRY_PREFIX = "telemetry/raw";

export type SupabaseInsertResult = { ok: boolean; status: number; detail: string };
export type RequestTelemetryContext = {
  host: string | null;
  deploymentUrl: string | null;
  origin: string | null;
  referer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  forwardedFor: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string | null;
};

function supabaseHeaders(serviceRoleKey: string, extra?: Record<string, string>) {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...extra };
}

function firstHeader(request: Request, names: string[]): string | null {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function safeHeaderValue(value: string | null, max = 600): string | null {
  if (!value) return null;
  return truncateUtf8String(value.replace(/\s+/g, " ").trim(), max);
}

export function getRequestTelemetryContext(request: Request): RequestTelemetryContext {
  const host = safeHeaderValue(request.headers.get("host"), 240);
  const proto = safeHeaderValue(firstHeader(request, ["x-forwarded-proto", "x-vercel-forwarded-proto"]), 24);
  const deploymentUrl = host ? `${proto || "https"}://${host}` : null;
  return {
    host,
    deploymentUrl,
    origin: safeHeaderValue(request.headers.get("origin"), 600),
    referer: safeHeaderValue(request.headers.get("referer"), 900),
    userAgent: safeHeaderValue(request.headers.get("user-agent"), 900),
    ipAddress: safeHeaderValue(firstHeader(request, ["x-real-ip", "x-client-ip", "cf-connecting-ip", "x-forwarded-for"]), 240),
    forwardedFor: safeHeaderValue(request.headers.get("x-forwarded-for"), 900),
    country: safeHeaderValue(request.headers.get("x-vercel-ip-country"), 80),
    region: safeHeaderValue(request.headers.get("x-vercel-ip-country-region"), 120),
    city: safeHeaderValue(request.headers.get("x-vercel-ip-city"), 160),
    latitude: safeHeaderValue(request.headers.get("x-vercel-ip-latitude"), 80),
    longitude: safeHeaderValue(request.headers.get("x-vercel-ip-longitude"), 80),
    timezone: safeHeaderValue(request.headers.get("x-vercel-ip-timezone"), 160),
  };
}

export function safeJsonPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_JSON_CHARS) return value as Record<string, unknown>;
    return { truncated: true, preview: truncateUtf8String(serialized, MAX_JSON_CHARS) };
  } catch {
    return {};
  }
}

export async function insertSupabaseRow(table: string, row: Record<string, unknown>, options: { onConflict?: string; mergeDuplicates?: boolean } = {}): Promise<SupabaseInsertResult> {
  if (!isSupabaseAdminConfigured()) return { ok: false, status: 0, detail: "supabase_not_configured" };
  let res: Response;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
    res = await fetch(`${url}/rest/v1/${table}${query}`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey, { Prefer: options.mergeDuplicates ? "resolution=merge-duplicates,return=minimal" : "return=minimal" }),
      body: JSON.stringify(row),
    });
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : String(error) };
  }
  if (res.ok) return { ok: true, status: res.status, detail: "" };
  return { ok: false, status: res.status, detail: await res.text().catch(() => "") };
}

function storageSafeSegment(value: string | null | undefined, fallback: string) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140) || fallback;
}

export async function storeRawTelemetryBackup(args: { category: string; sessionId?: string | null; anonymousVisitorId?: string | null; value: Record<string, unknown> | Record<string, unknown>[] }): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const objectPath = `${RAW_TELEMETRY_PREFIX}/${day}/${storageSafeSegment(args.category, "event")}/${storageSafeSegment(args.sessionId, "no-session")}/${storageSafeSegment(args.anonymousVisitorId, "no-visitor")}/${now.getTime()}-${crypto.randomUUID()}.json`;
    const res = await fetch(`${url}/storage/v1/object/${RAW_TELEMETRY_BUCKET}/${objectPath}`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey, { "Content-Type": "application/json", "x-upsert": "false" }),
      body: JSON.stringify({ capturedAt: now.toISOString(), category: args.category, sessionId: args.sessionId ?? null, anonymousVisitorId: args.anonymousVisitorId ?? null, value: args.value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function insertConversationTelemetryFallback(args: { sessionId: string; role?: "user" | "assistant"; source: string; value: Record<string, unknown> }): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/conversation_messages`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({ session_id: args.sessionId, role: args.role ?? "user", source: args.source, message: truncateUtf8String(JSON.stringify(args.value), FALLBACK_MESSAGE_CHARS) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
