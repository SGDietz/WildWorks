import { getSupabaseAdminConfig } from "./supabaseAdmin";
import { notifyTelemetryDigestByEmail } from "./voiceEmailNotifications";

type VisitorSession = { session_id: string; route: string | null; traffic_class: string };
type ActionRow = { session_id: string; traffic_class: string };
type MessageRow = { session_id: string; role: string; traffic_class: string };
type LeadRow = { status: string; traffic_class: string };
type OutboxRow = { status: string };

async function restRows<T>(path: string): Promise<T[]> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`telemetry_digest_query_failed:${response.status}`);
  return await response.json() as T[];
}

export async function sendDailyTelemetryDigest(now = new Date()) {
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start = encodeURIComponent(periodStart.toISOString());
  const end = encodeURIComponent(periodEnd.toISOString());
  const [sessions, actions, messages, leads, outbox] = await Promise.all([
    restRows<VisitorSession>(`visitor_sessions?select=session_id,route,traffic_class&last_seen_at=gte.${start}&last_seen_at=lte.${end}&limit=10000`),
    restRows<ActionRow>(`visitor_actions?select=session_id,traffic_class&created_at=gte.${start}&created_at=lte.${end}&limit=10000`),
    restRows<MessageRow>(`conversation_messages?select=session_id,role,traffic_class&created_at=gte.${start}&created_at=lte.${end}&limit=10000`),
    restRows<LeadRow>(`iscott_leads?select=status,traffic_class&submitted_at=gte.${start}&submitted_at=lte.${end}&limit=1000`),
    restRows<OutboxRow>(`voice_email_outbox?select=status&updated_at=gte.${start}&updated_at=lte.${end}&status=eq.failed&limit=1000`),
  ]);
  const publicSessions = sessions.filter((row) => row.traffic_class === "public");
  const humanSessionIds = new Set([
    ...actions.filter((row) => row.traffic_class === "public").map((row) => row.session_id),
    ...messages.filter((row) => row.traffic_class === "public" && row.role === "user").map((row) => row.session_id),
  ]);
  const routeCounts = new Map<string, number>();
  for (const row of publicSessions) {
    const route = row.route || "unknown";
    routeCounts.set(route, (routeCounts.get(route) || 0) + 1);
  }
  const digestDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return notifyTelemetryDigestByEmail({
    digestDate,
    periodStart,
    periodEnd,
    publicSessions: publicSessions.length,
    humanSignals: humanSessionIds.size,
    publicMessages: messages.filter((row) => row.traffic_class === "public" && row.role === "user").length,
    submittedLeads: leads.filter((row) => row.status === "submitted" && row.traffic_class === "public").length,
    failedNotifications: outbox.length,
    botSessions: sessions.filter((row) => row.traffic_class === "bot").length,
    testSessions: sessions.filter((row) => row.traffic_class === "test").length,
    ownerSessions: sessions.filter((row) => row.traffic_class === "owner").length,
    topRoutes: [...routeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([route, count]) => ({ route, count })),
  });
}
