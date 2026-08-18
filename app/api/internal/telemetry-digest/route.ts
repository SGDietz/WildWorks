import { authorizeVoiceEmailDrainRequest } from "@/src/lib/voiceCronAuthorization";
import { sendDailyTelemetryDigest } from "@/src/lib/telemetryDigest";

export const runtime = "nodejs";

async function handle(request: Request) {
  if (!authorizeVoiceEmailDrainRequest(request)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await sendDailyTelemetryDigest();
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
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "telemetry_digest_failed",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;

