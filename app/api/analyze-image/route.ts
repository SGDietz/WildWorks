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
    prefix: "avatar-analyze-image",
    perMinute: 12,
    perDay: 120,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await readLimitedRequestBody(request, 15_000_000);
    const response = await fetch(`${REMOTE_AVATAR_ORIGIN}/api/analyze-image`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/octet-stream",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok && response.status >= 500) {
      await logServerTelemetryEvent({ request, eventType: "avatar_image_analysis_failed", severity: "high", provider: "liveavatar-demo", route: "/api/analyze-image", statusCode: response.status });
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
      return Response.json({ error: "Image payload too large" }, { status: 413 });
    }
    await logServerTelemetryEvent({ request, eventType: "avatar_image_analysis_failed", severity: "high", provider: "liveavatar-demo", route: "/api/analyze-image", statusCode: 502 });
    return Response.json({ error: "Image analysis unavailable" }, { status: 502 });
  }
}
