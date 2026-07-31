import { createHash } from "node:crypto";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";

const WINDOW_SECONDS = 60;
const DEFAULT_PER_MINUTE = 60;
const DEFAULT_PER_DAY = 1000;

type RateLimitOptions = {
  prefix?: string;
  perMinute?: number;
  perDay?: number;
};

type MemoryCounter = {
  minuteBucket: string;
  minuteCount: number;
  dayBucket: string;
  dayCount: number;
};

const memoryCounters = new Map<string, MemoryCounter>();

function getEnvInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function currentMinuteBucket(): string {
  return new Date().toISOString().slice(0, 16);
}

function currentDayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

async function upstashPipeline(commands: (string | number)[][]): Promise<(number | null)[]> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) throw new Error("Upstash is not configured");

  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("Upstash rate limit request failed");

  const json = (await res.json()) as Array<{ result?: number; error?: string }>;
  return json.map((row) => (typeof row.result === "number" ? row.result : null));
}

function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(WINDOW_SECONDS) },
  });
}

function unavailableResponse(): Response {
  return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Retry-After": "60" },
  });
}

function checkMemoryRateLimit(request: Request, options: RateLimitOptions): Response | null {
  const minuteBucket = currentMinuteBucket();
  const dayBucket = currentDayBucket();
  const key = `${options.prefix || "public"}:${hashIp(getClientIp(request))}`;
  const existing = memoryCounters.get(key);
  const next: MemoryCounter = {
    minuteBucket,
    minuteCount: existing?.minuteBucket === minuteBucket ? existing.minuteCount + 1 : 1,
    dayBucket,
    dayCount: existing?.dayBucket === dayBucket ? existing.dayCount + 1 : 1,
  };
  memoryCounters.set(key, next);

  if (memoryCounters.size > 5_000) {
    for (const [candidate, value] of memoryCounters) {
      if (value.dayBucket !== dayBucket) memoryCounters.delete(candidate);
    }
  }

  const perMinute = options.perMinute ?? getEnvInt("RATE_LIMIT_PER_MINUTE", DEFAULT_PER_MINUTE);
  const perDay = options.perDay ?? getEnvInt("RATE_LIMIT_PER_DAY", DEFAULT_PER_DAY);
  return next.minuteCount > perMinute || next.dayCount > perDay ? rateLimitResponse() : null;
}

export async function checkRateLimit(request: Request, options: RateLimitOptions = {}): Promise<Response | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!base || !token) return checkMemoryRateLimit(request, options);

  const hashed = hashIp(getClientIp(request));
  const prefix = options.prefix || "public";
  const minKey = `ww:rl:${prefix}:ip:${hashed}:m:${currentMinuteBucket()}`;
  const dayKey = `ww:rl:${prefix}:ip:${hashed}:d:${currentDayBucket()}`;
  const perMinute = options.perMinute ?? getEnvInt("RATE_LIMIT_PER_MINUTE", DEFAULT_PER_MINUTE);
  const perDay = options.perDay ?? getEnvInt("RATE_LIMIT_PER_DAY", DEFAULT_PER_DAY);

  try {
    const results = await upstashPipeline([
      ["INCR", minKey],
      ["EXPIRE", minKey, WINDOW_SECONDS * 2],
      ["INCR", dayKey],
      ["EXPIRE", dayKey, 4 * 86400],
    ]);
    const minCount = results[0] ?? 0;
    const dayCount = results[2] ?? 0;
    if (results.some((value) => value === null)) throw new Error("Invalid Upstash response");
    if (minCount > perMinute || dayCount > perDay) return rateLimitResponse();
    return null;
  } catch {
    return checkMemoryRateLimit(request, options);
  }
}

export async function checkCriticalRateLimit(
  request: Request,
  options: {
    eventType: string;
    perMinute?: number;
    perDay?: number;
    globalPerDay?: number;
  },
): Promise<Response | null> {
  if (process.env.NODE_ENV !== "production") return null;
  if (!isSupabaseAdminConfigured()) return unavailableResponse();

  const anonymousVisitorId = `rate-limit:${hashIp(getClientIp(request))}`;
  const perMinute = options.perMinute ?? 2;
  const perDay = options.perDay ?? 12;
  const globalPerDay = options.globalPerDay ?? 100;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const reservation = await fetch(`${url}/rest/v1/rpc/reserve_api_rate_limit`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_event_type: options.eventType,
        p_key_hash: anonymousVisitorId,
        p_per_minute: perMinute,
        p_per_day: perDay,
        p_global_per_day: globalPerDay,
      }),
    });
    if (!reservation.ok) return unavailableResponse();
    return (await reservation.json()) === true ? null : rateLimitResponse();
  } catch {
    return unavailableResponse();
  }
}
