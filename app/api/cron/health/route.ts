import { readCodexOperationsHealth } from "@/src/lib/codexOperationsHealth";
import { authorizeVoiceEmailDrainRequest } from "@/src/lib/voiceCronAuthorization";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "@/src/lib/supabaseAdmin";
import { sendWildWorksOperationalAlert } from "@/src/lib/wildworksOperationalAlerts";
import { logServerTelemetryEvent } from "@/src/lib/serverTelemetryCapture";
import { nextHealthNotice, type HealthNotice } from "@/src/lib/wildworksHealthNoticePolicy";
import {
  API_KEY as LIVEAVATAR_API_KEY,
  API_URL as LIVEAVATAR_API_URL,
  AVATAR_ID as LIVEAVATAR_AVATAR_ID,
  CONTEXT_ID as LIVEAVATAR_CONTEXT_ID,
  VOICE_ID as LIVEAVATAR_VOICE_ID,
} from "@/app/api/liveavatar/secrets";

/**
 * THE CLOUD WATCHER for WildWorks. Added 2026-08-24 on G's instruction:
 *
 *   "There should be no business based crons from this little computer, which
 *    can be destroyed, be stolen, be off. I turn it off a lot... Every single
 *    thing needs to be cloud based and needs to have a redundancy."
 *
 * WildWorks already had a health watcher - ops\Watch-WildWorksHealth.ps1, driven
 * by the WildWorks-Operational-Health scheduled task every 5 minutes. It runs on
 * G's laptop. A watcher that is asleep reports "all clear" by being silent, and
 * silence is indistinguishable from everything being on fire.
 *
 * This is the same check running on Vercel, which is always on. The laptop task
 * stays as the second leg, not the first. G's rule: "two is one, one is none."
 *
 * WHY THE DAILY REPORT EXISTS. Once a day this fires with ?daily=1 and speaks up
 * even when nothing is wrong. A quiet phone then means the watcher is alive and
 * found nothing, rather than the watcher being dead. Without it, the single most
 * dangerous state - watcher down, site down, nobody told - looks exactly like a
 * good day. Deliberately copied from aiASAP's app/api/cron/health/route.ts so the
 * three sites behave the same way.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** Overlaps the 15-minute schedule on purpose: better a repeat than a gap. */
const LOOKBACK_MINUTES = 20;

/** A lead sitting unsent longer than this is a real problem, not a slow minute. */
const OUTBOX_STUCK_MINUTES = 20;

type Finding = { headline: string; detail: string };
const HEALTH_ENVIRONMENT = process.env.VERCEL_ENV ?? "local";
// Held automated tests cannot represent a missed customer delivery. Preserve
// unclassified historical leads and genuine owner smoke tests in the check.
const DELIVERABLE_LEADS = "&or=(traffic_class.is.null,traffic_class.in.(public,owner))";

async function readLastHealthNotice(): Promise<HealthNotice | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  try {
    const query = new URLSearchParams({
      select: "payload", event_type: "in.(wildworks_cloud_health_ok,wildworks_cloud_health_finding)",
      "payload->>health_environment": `eq.${HEALTH_ENVIRONMENT}`,
      order: "created_at.desc", limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/app_events?${query}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      cache: "no-store", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const notice = rows?.[0]?.payload?.last_notice;
    return notice && typeof notice.fingerprint === "string" && typeof notice.healthy === "boolean"
      && typeof notice.at === "string" && Number.isFinite(Date.parse(notice.at)) ? notice : null;
  } catch { return null; }
}

type LiveAvatarResource = "avatar" | "context" | "voice";

async function configuredLiveAvatarResourceResolves(
  resource: LiveAvatarResource,
  id: string,
): Promise<boolean> {
  if (!LIVEAVATAR_API_KEY || !LIVEAVATAR_API_URL || !id) return false;
  const resourcePath = resource === "avatar" ? "avatars" : resource === "context" ? "contexts" : "voices";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  timeout.unref?.();
  try {
    const response = await fetch(
      `${LIVEAVATAR_API_URL.replace(/\/$/, "")}/v1/${resourcePath}/${encodeURIComponent(id)}`,
      {
        headers: { "X-API-KEY": LIVEAVATAR_API_KEY },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.data?.id === id;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function countRows(pathAndQuery: string): Promise<number | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const range = res.headers.get("content-range") ?? "/0";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!authorizeVoiceEmailDrainRequest(request)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const daily = new URL(request.url).searchParams.get("daily") === "1";
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const findings: Finding[] = [];
  const notes: string[] = [];

  const stuckSince = new Date(Date.now() - OUTBOX_STUCK_MINUTES * 60_000).toISOString();
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();

  // Read-only provider guard. These documented GETs do not mint a session or
  // change provider state; they only prove the exact configured records still
  // resolve. IDs and provider bodies never enter findings, telemetry, or alerts.
  const configuredResources = [
    ["avatar", LIVEAVATAR_AVATAR_ID],
    ["context", LIVEAVATAR_CONTEXT_ID],
    ["voice", LIVEAVATAR_VOICE_ID],
  ] as const;
  const resourceResults = await Promise.all(
    configuredResources.map(async ([resource, id]) => ({
      resource,
      configured: Boolean(id),
      resolves: await configuredLiveAvatarResourceResolves(resource, id),
    })),
  );
  for (const result of resourceResults) {
    if (!result.configured) {
      findings.push({
        headline: `LiveAvatar ${result.resource} is not configured`,
        detail: `The cloud watcher cannot verify the ${result.resource} required by iScott.`,
      });
    } else if (!result.resolves) {
      findings.push({
        headline: `Configured LiveAvatar ${result.resource} does not resolve`,
        detail: `The provider's read-only lookup did not return the exact configured ${result.resource}.`,
      });
    } else {
      notes.push(`Configured LiveAvatar ${result.resource} resolves.`);
    }
  }

  // 1. THE MONEY PATH. A lead that reached the outbox and never left it is a
  //    customer who contacted G and got silence.
  const stuck = await countRows(
    `voice_email_outbox?select=id&status=in.(pending,sending)&created_at=lt.${encodeURIComponent(stuckSince)}`,
  );
  if (stuck === null) {
    findings.push({
      headline: "Cannot read the lead outbox",
      detail: "Supabase did not answer. The email queue cannot be checked, so a stuck lead would be invisible.",
    });
  } else if (stuck > 0) {
    findings.push({
      headline: `${stuck} lead email${stuck === 1 ? "" : "s"} stuck in the queue`,
      detail: `Unsent for more than ${OUTBOX_STUCK_MINUTES} minutes. Somebody contacted WildWorks and the message has not reached G.`,
    });
  } else {
    notes.push("Lead outbox clear.");
  }

  // 2. Anything that gave up entirely.
  const failed = await countRows(
    `voice_email_outbox?select=id&status=eq.failed&updated_at=gte.${encodeURIComponent(since)}`,
  );
  if (failed && failed > 0) {
    findings.push({
      headline: `${failed} lead email${failed === 1 ? "" : "s"} failed to send`,
      detail: "The last provider attempt failed. The retry worker should recover these; continued failures require attention.",
    });
  }

  const deadLetter = await countRows(
    `voice_email_outbox?select=id&status=eq.dead_letter&last_error=neq.superseded_by_complete_lead&updated_at=gte.${encodeURIComponent(since)}`,
  );
  if (deadLetter && deadLetter > 0) {
    findings.push({
      headline: `${deadLetter} notification${deadLetter === 1 ? "" : "s"} exhausted retries`,
      detail: "A non-superseded dead-letter row needs review; the retry worker will not send it again automatically.",
    });
  }

  const ownerDrift = await countRows(
    "iscott_leads?select=session_id&status=eq.submitted&notification_status=neq.sent" + DELIVERABLE_LEADS,
  );
  if (ownerDrift && ownerDrift > 0) {
    findings.push({
      headline: `${ownerDrift} submitted lead${ownerDrift === 1 ? "" : "s"} lack a sent owner notification`,
      detail: "Lead state and owner-delivery state disagree and require reconciliation.",
    });
  }

  const visitorPairFailures = await countRows(
    "iscott_leads?select=session_id&status=eq.submitted&contact_method=eq.email&visitor_confirmation_status=in.(failed,blocked)" + DELIVERABLE_LEADS,
  );
  if (visitorPairFailures && visitorPairFailures > 0) {
    findings.push({
      headline: `${visitorPairFailures} visitor receipt${visitorPairFailures === 1 ? "" : "s"} failed after owner submission`,
      detail: "The paired owner and visitor notification package is only partially complete.",
    });
  }

  const staleVisitorQueue = await countRows(
    `iscott_leads?select=session_id&status=eq.submitted&contact_method=eq.email&visitor_confirmation_status=eq.queued&submitted_at=lt.${encodeURIComponent(stuckSince)}` + DELIVERABLE_LEADS,
  );
  if (staleVisitorQueue && staleVisitorQueue > 0) {
    findings.push({
      headline: `${staleVisitorQueue} visitor receipt${staleVisitorQueue === 1 ? "" : "s"} stuck queued`,
      detail: `The visitor side of a submitted package has remained queued for more than ${OUTBOX_STUCK_MINUTES} minutes.`,
    });
  }

  // 3. Is the database answering at all? If this is null everything above is
  //    unknowable rather than fine.
  const reachable = await countRows("visitor_sessions?select=session_id");
  if (reachable === null) {
    findings.push({
      headline: "Database unreachable",
      detail: "The site cannot read Supabase. Leads, transcripts and telemetry are all affected.",
    });
  } else {
    notes.push(`Database reachable (${reachable.toLocaleString()} sessions recorded).`);
  }

  if (isSupabaseAdminConfigured()) {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    for (const issue of await readCodexOperationsHealth("wildworks", url, serviceRoleKey)) {
      findings.push({ headline: issue.code, detail: issue.detail });
    }
  }
  const healthy = findings.length === 0;
  if (dryRun) return Response.json({ ok: true, healthy, dryRun, findings, notes, monitorVersion: "2026-09-05-errors-only" });
  let lastNotice = await readLastHealthNotice();
  if (healthy) lastNotice = null; // Silent recovery re-arms a later recurrence.
  const notice = nextHealthNotice({ findings: findings.map((finding) => finding.headline),
    daily, previous: lastNotice, now: Date.now() });

  if (notice && !healthy) {
    const delivery = await sendWildWorksOperationalAlert({
      category: "cloud-health",
      component: "wildworks cloud watcher",
      route: "/api/cron/health",
      correlationId: findings[0].headline,
      summary: findings.map((f) => `${f.headline} - ${f.detail}`).join(" | "),
    });
    if (delivery.sent) lastNotice = notice;
  }

  await logServerTelemetryEvent({
    request,
    eventType: healthy ? "wildworks_cloud_health_ok" : "wildworks_cloud_health_finding",
    severity: healthy ? "low" : "high",
    provider: "supabase",
    route: "/api/cron/health",
    statusCode: 200,
    payload: { daily, findingCount: findings.length, findings: findings.map((f) => f.headline),
      health_environment: HEALTH_ENVIRONMENT, last_notice: lastNotice },
  });

  return Response.json(
    { ok: true, healthy, findings, notes, monitorVersion: "2026-09-05-errors-only" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
