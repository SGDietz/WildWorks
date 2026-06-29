const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxyAvatarSessionRequest(request: Request, { params }: Params) {
  const { path = [] } = await params;
  const target = new URL(`/api/v1/sessions/${path.join("/")}`, REMOTE_AVATAR_ORIGIN);
  target.search = new URL(request.url).search;

  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: request.headers.get("authorization") ?? "",
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    cache: "no-store",
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(request: Request, context: Params) {
  return proxyAvatarSessionRequest(request, context);
}

export async function POST(request: Request, context: Params) {
  return proxyAvatarSessionRequest(request, context);
}
