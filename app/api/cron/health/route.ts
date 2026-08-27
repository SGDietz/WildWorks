import { authorizeVoiceEmailDrainRequest } from "@/src/lib/voiceCronAuthorization";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "@/src/lib/supabaseAdmin";
import { sendWildWorksOperationalAlert } from "@/src/lib/wildworksOperationalAlerts";
import { logServerTelemetryEvent } from "@/src/lib/serverTelemetryCapture";

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
  const findings: Finding[] = [];
  const notes: string[] = [];

  const stuckSince = new Date(Date.now() - OUTBOX_STUCK_MINUTES * 60_000).toISOString();
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();

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
      detail: "The provider rejected them. These will not retry on their own.",
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

  const healthy = findings.length === 0;

  if (!healthy) {
    await sendWildWorksOperationalAlert({
      category: "cloud-health",
      component: "wildworks cloud watcher",
      route: "/api/cron/health",
      correlationId: findings[0].headline,
      summary: findings.map((f) => `${f.headline} - ${f.detail}`).join(" | "),
    });
  } else if (daily) {
    // Silence is a finding. Speak once a day even when all is well.
    await sendWildWorksOperationalAlert({
      category: "cloud-health",
      component: "wildworks cloud watcher",
      route: "/api/cron/health",
      correlationId: "daily-all-clear",
      summary: `Daily all-clear. Watcher ran and found nothing. ${notes.join(" ")}`,
    });
  }

  await logServerTelemetryEvent({
    request,
    eventType: healthy ? "wildworks_cloud_health_ok" : "wildworks_cloud_health_finding",
    severity: healthy ? "low" : "high",
    provider: "supabase",
    route: "/api/cron/health",
    statusCode: 200,
    payload: { daily, findingCount: findings.length, findings: findings.map((f) => f.headline) },
  });

  return Response.json(
    { ok: true, healthy, daily, findings, notes },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
