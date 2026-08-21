import { authorizeVoiceEmailDrainRequest } from "@/src/lib/voiceCronAuthorization";
import { sendDailyTelemetryDigest } from "@/src/lib/telemetryDigest";
import { logServerTelemetryEvent } from "@/src/lib/serverTelemetryCapture";

export const runtime = "nodejs";

async function handle(request: Request) {
  if (!authorizeVoiceEmailDrainRequest(request)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await sendDailyTelemetryDigest();
    if (!result.ok) {
      await logServerTelemetryEvent({ request, eventType: "telemetry_digest_failed", severity: "high", provider: "resend", route: "/api/internal/telemetry-digest", statusCode: 503 });
    }
    return Response.json({
      ok: result.ok,
      queued: result.queued,
      delivered: result.delivered,
      deduplicated: result.deduplicated,
      detail: result.detail,
    }, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    await logServerTelemetryEvent({ request, eventType: "telemetry_digest_failed", severity: "high", provider: "resend", route: "/api/internal/telemetry-digest", statusCode: 503 });
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "telemetry_digest_failed",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
