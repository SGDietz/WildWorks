import {
  authorizeVoiceRetentionRequest,
  executeVoiceRetention,
  isVoiceRetentionDryRun,
  isVoiceRetentionEnabled,
  voiceRetentionBatchLimit,
  voiceRetentionConfigurationError,
} from "@/src/lib/voiceRetention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  if (!authorizeVoiceRetentionRequest(request)) {
    return Response.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dryRun = isVoiceRetentionDryRun(request);
  if (!dryRun && !isVoiceRetentionEnabled()) {
    return Response.json(
      { ok: false, error: "voice_retention_not_enabled" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const configurationError = dryRun ? null : voiceRetentionConfigurationError();
  if (configurationError) {
    return Response.json(
      { ok: false, error: configurationError },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await executeVoiceRetention({
    dryRun,
    limit: voiceRetentionBatchLimit(),
  });
  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const GET = handle;
export const POST = handle;
