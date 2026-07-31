import { API_URL } from "../../../liveavatar/secrets";
import {
  assertAllowedOrigin,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from "../../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";

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
  const originError = assertAllowedOrigin(request);
  if (originError) return originError;

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

    const contentType = response.headers.get("content-type") ?? "application/json";
    return new Response(response.body, {
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
