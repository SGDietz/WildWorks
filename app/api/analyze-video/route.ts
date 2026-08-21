import {
  assertAllowedOrigin,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { logServerTelemetryEvent } from "../../../src/lib/serverTelemetryCapture";

const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = assertAllowedOrigin(request);
  if (originError) return originError;

  const rateLimitError = await checkRateLimit(request, {
    prefix: "avatar-analyze-video",
    perMinute: 6,
    perDay: 60,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await readLimitedRequestBody(request, 50_000_000);
    const response = await fetch(`${REMOTE_AVATAR_ORIGIN}/api/analyze-video`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok && response.status >= 500) {
      await logServerTelemetryEvent({ request, eventType: "avatar_video_analysis_failed", severity: "high", provider: "liveavatar-demo", route: "/api/analyze-video", statusCode: response.status });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Video payload too large" }, { status: 413 });
    }
    await logServerTelemetryEvent({ request, eventType: "avatar_video_analysis_failed", severity: "high", provider: "liveavatar-demo", route: "/api/analyze-video", statusCode: 502 });
    return Response.json({ error: "Video analysis unavailable" }, { status: 502 });
  }
}
