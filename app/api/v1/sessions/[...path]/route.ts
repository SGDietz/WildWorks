import { API_URL } from "../../../liveavatar/secrets";

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
    const response = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
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
  } catch {
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
