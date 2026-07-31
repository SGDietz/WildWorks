import { truncateUtf8String } from "./apiRouteSecurity";
import { getRequestTelemetryContext, insertConversationTelemetryFallback, insertSupabaseRow, safeJsonPayload, storeRawTelemetryBackup } from "./telemetryServer";

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
}) {
  const server = getRequestTelemetryContext(args.request);
  const sessionId = cleanString(args.sessionId, 160);
  const anonymousVisitorId = cleanString(args.anonymousVisitorId, 160);
  const fallbackSessionId = sessionId || anonymousVisitorId || "server_app_event";
  const route = cleanString(args.route, 220) ?? cleanString(new URL(args.request.url).pathname, 220);
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
  };

  const rawBackupOk = await storeRawTelemetryBackup({ category: "server_app_event", sessionId: fallbackSessionId, anonymousVisitorId, value: row });
  const result = await insertSupabaseRow("app_events", row);
  if (result.ok) return;

  const fallbackOk = await insertConversationTelemetryFallback({ sessionId: fallbackSessionId, source: "app_event", value: { table: "app_events", tableInsertStatus: result.status, tableInsertDetail: result.detail, ...row } });
  if (!fallbackOk && !rawBackupOk && result.detail !== "supabase_not_configured") {
    console.warn("Server telemetry event not stored:", result.detail);
  }
}
