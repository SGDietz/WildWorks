import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { truncateUtf8String } from "./apiRouteSecurity";
import {
  canDispatchFirstPublicMessageAlert,
  canDispatchIScottLeadNotification,
  isPublicLeadAlertEligible,
  resolveTrafficClassification,
  type TrafficClass,
  type TrafficClassification,
} from "./iscottTrafficResolve";

export type { TrafficClass, TrafficClassification };
export {
  canDispatchFirstPublicMessageAlert,
  canDispatchIScottLeadNotification,
  isPublicLeadAlertEligible,
  resolveTrafficClassification,
};

type IdentityLabelRow = {
  traffic_class?: unknown;
  reason?: unknown;
  confidence?: unknown;
  active?: unknown;
};

const LABEL_CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: TrafficClassification | null }>();
const TRAFFIC_CLASSES = new Set<TrafficClass>(["owner", "test", "public", "bot"]);

function clean(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const result = value.replace(/\s+/g, " ").trim();
  return result ? truncateUtf8String(result, max) : null;
}

async function explicitLabel(anonymousVisitorId: string | null): Promise<TrafficClassification | null> {
  if (!anonymousVisitorId || !isSupabaseAdminConfigured()) return null;
  const cached = cache.get(anonymousVisitorId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(
      `${url}/rest/v1/visitor_identity_labels?anonymous_visitor_id=eq.${encodeURIComponent(anonymousVisitorId)}&active=eq.true&select=traffic_class,reason,confidence&limit=1`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store" },
    );
    const rows = response.ok ? (await response.json()) as IdentityLabelRow[] : [];
    const row = rows[0];
    const trafficClass = clean(row?.traffic_class, 16) as TrafficClass | null;
    const value = trafficClass && TRAFFIC_CLASSES.has(trafficClass)
      ? {
          trafficClass,
          reason: clean(row?.reason, 120) ?? "explicit_identity_label",
          confidence: typeof row?.confidence === "number" ? Math.max(0, Math.min(1, row.confidence)) : 1,
        }
      : null;
    cache.set(anonymousVisitorId, { expiresAt: Date.now() + LABEL_CACHE_MS, value });
    return value;
  } catch {
    return null;
  }
}

export async function classifyTraffic(args: {
  anonymousVisitorId?: string | null;
  userAgent?: string | null;
  origin?: string | null;
}): Promise<TrafficClassification> {
  const anonymousVisitorId = clean(args.anonymousVisitorId, 160);
  const label = await explicitLabel(anonymousVisitorId);
  return resolveTrafficClassification({
    anonymousVisitorId,
    userAgent: args.userAgent,
    explicitLabel: label,
    origin: args.origin,
  });
}

export function trafficColumns(classification: TrafficClassification) {
  return {
    traffic_class: classification.trafficClass,
    traffic_reason: classification.reason,
    traffic_confidence: classification.confidence,
  };
}

export function isMeaningfulPublicMessage(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 12) return false;
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 3) return false;
  return !/^(hello|hi|hey|test|testing|you there|are you there|can you hear me)[!?. ]*$/i.test(text);
}

// One place to derive "where did this request come from", so every call site
// agrees. Origin and Referer are what a browser actually sends; the request host
// is the fallback for same-origin server calls.
export function originFromRequest(request: Request): string | null {
  try {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = (() => { try { return new URL(request.url).host; } catch { return ""; } })();
    const joined = [origin, referer, host].filter(Boolean).join(" ");
    return joined || null;
  } catch {
    return null;
  }
}
