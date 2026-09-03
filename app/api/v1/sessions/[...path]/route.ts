import { API_URL } from "../../../liveavatar/secrets";
import {
  assertAllowedOrigin,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "../../../../../src/lib/apiRouteSecurity";
import { logIScottOriginRejection } from "../../../../../src/lib/iscottOriginTelemetry";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  armLiveAvatarIdleSession,
  clearLiveAvatarIdleSession,
} from "../../../../../src/lib/liveAvatarIdleSessions";
import { logServerTelemetryEvent } from "../../../../../src/lib/serverTelemetryCapture";

// H473c: Node raises Error("aborted") from abortIncoming/socketOnClose when the
// CLIENT closes the connection mid-request. On this page that is routine - the
// avatar tears down on Finish and takes its in-flight requests with it. It is
// not a server fault and must not be logged as one, or the alert channel fills
// with noise that hides real faults.
const isClientDisconnect = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  const message = error.message || "";
  return name === "AbortError"
    || message === "aborted"
    || message.includes("ECONNRESET")
    || message.includes("aborted");
};

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    path?: string[];
  }>;
};

function getBearerToken(authHeader: string | null) {
  const prefix = "Bearer ";
  if (!authHeader?.startsWith(prefix)) return "";
  return authHeader.slice(prefix.length).trim();
}

async function proxyAvatarSessionRequest(request: Request, { params }: Params) {
  const originError = assertAllowedOrigin(request, {
    trustedSameOriginMarker: {
      name: "x-wildworks-avatar-request",
      value: "same-origin-v1",
    },
  });
  if (originError) {
    await logIScottOriginRejection(request, new URL(request.url).pathname).catch(() => undefined);
    return originError;
  }

  const rateLimitError = await checkRateLimit(request, {
    prefix: "liveavatar-session-proxy",
    perMinute: 120,
    perDay: 2_000,
  });
  if (rateLimitError) return rateLimitError;

  const token = getBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return Response.json(
      { code: 403, data: { message: "Authorization required" } },
      { status: 403 },
    );
  }

  const { path = [] } = await params;
  const baseUrl = API_URL.replace(/\/$/, "");
  const target = new URL(`/v1/sessions/${path.join("/")}`, baseUrl);
  target.search = new URL(request.url).search;

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await readLimitedRequestBody(request, 1_000_000);
    const response = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      },
      body,
      cache: "no-store",
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const action = path.join("/");
    let failureBody: string | null = null;
    if (!response.ok && action !== "stop") {
      // 2026-09-02 (Codex H460 / Claude): production wildworks.ai start returned 400
      // at 21:37Z with an empty telemetry payload, so nobody could see WHY the
      // vendor refused. Read the vendor body once, log a bounded copy (no secrets
      // live in it), and hand the same bytes on to the client.
      try {
        failureBody = await response.text();
      } catch {
        failureBody = null;
      }
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_session_proxy_failed",
        severity: "high",
        provider: "liveavatar",
        route: `/api/v1/sessions/${action}`,
        statusCode: response.status,
        payload: { vendorBody: (failureBody ?? "").slice(0, 600) },
      });
    }
    if (response.ok && action === "start") {
      armLiveAvatarIdleSession(token, API_URL);
    } else if (action === "stop") {
      clearLiveAvatarIdleSession(token);
    }

    const contentType = response.headers.get("content-type") ?? "application/json";
    return new Response(failureBody !== null ? failureBody : response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { code: 413, data: { message: "Request body too large" } },
        { status: 413 },
      );
    }
    const clientHungUp = isClientDisconnect(error);
    await logServerTelemetryEvent({
      request,
      eventType: clientHungUp
        ? "liveavatar_session_proxy_client_disconnected"
        : "liveavatar_session_proxy_failed",
      severity: clientHungUp ? "low" : "high",
      provider: "liveavatar",
      route: `/api/v1/sessions/${path.join("/")}`,
      statusCode: clientHungUp ? 499 : 500,
      payload: {
        // H471 2026-09-02: this block used to log a bare 500. Two stop failures
        // during G's 20:52 ride were therefore undiagnosable. Error name,
        // message and a short stack are bounded and carry no secrets.
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 400),
        errorStack: (error instanceof Error && error.stack ? error.stack : "").slice(0, 600),
      },
    });
    return Response.json(
      { code: 500, data: { message: "LiveAvatar session proxy failed" } },
      { status: 500 },
    );
  }
}

export async function GET(request: Request, context: Params) {
  return proxyAvatarSessionRequest(request, context);
}

export async function POST(request: Request, context: Params) {
  return proxyAvatarSessionRequest(request, context);
}
