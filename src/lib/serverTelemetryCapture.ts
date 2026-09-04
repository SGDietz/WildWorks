import { truncateUtf8String } from "./apiRouteSecurity";
import { getRequestTelemetryContext, insertConversationTelemetryFallback, insertSupabaseRow, safeJsonPayload, storeRawTelemetryBackup } from "./telemetryServer";
import { classifyTraffic, trafficColumns, originFromRequest } from "./trafficClassification";
import { queueOperationalAlertFromTelemetry } from "./wildworksOperationalAlerts";

function cleanString(value: unknown, maxChars = 1000): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

export async function logServerTelemetryEvent(args: {
  request: Request;
  eventType: string;
  severity?: "critical" | "high" | "medium" | "low";
  provider?: string | null;
  sessionId?: string | null;
  anonymousVisitorId?: string | null;
  route?: string | null;
  statusCode?: number | null;
  userVisibleState?: string | null;
  payload?: Record<string, unknown>;
  // H455: alert-dispatch admission only. Never written to the stored row.
  deferToClientStreak?: boolean;
}) {
  const server = getRequestTelemetryContext(args.request);
  const sessionId = cleanString(args.sessionId, 160);
  const anonymousVisitorId = cleanString(args.anonymousVisitorId, 160);
  const fallbackSessionId = sessionId || anonymousVisitorId || "server_app_event";
  const route = cleanString(args.route, 220) ?? cleanString(new URL(args.request.url).pathname, 220);
  const traffic = await classifyTraffic({
    anonymousVisitorId,
    userAgent: server.userAgent,
    origin: originFromRequest(args.request),
  });
  const row = {
    session_id: sessionId,
    anonymous_visitor_id: anonymousVisitorId,
    event_type: cleanString(args.eventType, 120) ?? "server_event",
    severity: args.severity ?? "low",
    provider: cleanString(args.provider, 80),
    route,
    status_code: typeof args.statusCode === "number" && Number.isInteger(args.statusCode) && args.statusCode >= 100 && args.statusCode <= 599 ? args.statusCode : null,
    user_visible_state: cleanString(args.userVisibleState, 240),
    payload: { ...safeJsonPayload(args.payload), server },
    ...trafficColumns(traffic),
  };

  queueOperationalAlertFromTelemetry({
    eventType: row.event_type,
    provider: row.provider,
    route: row.route,
    statusCode: row.status_code,
    sessionId: row.session_id ?? row.anonymous_visitor_id,
    failStreak: (() => { const value = (row.payload as Record<string, unknown>).failStreak; return typeof value === "number" && Number.isFinite(value) ? value : null; })(),
    deferToClientStreak: args.deferToClientStreak === true,
  });

  // 2026-08-24: the raw copy used to be written on EVERY event, before the
  // primary insert even ran - a second permanent pile of network, location,
  // referrer and device data with no deletion path. It is a backup, so it now
  // only happens when the real write has actually failed.
  const result = await insertSupabaseRow("app_events", row);
  if (result.ok) return;

  const fallbackOk = await insertConversationTelemetryFallback({ sessionId: fallbackSessionId, source: "app_event", value: { table: "app_events", tableInsertStatus: result.status, tableInsertDetail: result.detail, ...row } });
  const rawBackupOk = fallbackOk
    ? false
    : await storeRawTelemetryBackup({ category: "server_app_event", sessionId: fallbackSessionId, anonymousVisitorId, value: row });
  if (!fallbackOk && !rawBackupOk && result.detail !== "supabase_not_configured") {
    console.warn("Server telemetry event not stored:", result.detail);
  }
}
