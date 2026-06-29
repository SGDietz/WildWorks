const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = await fetch(`${REMOTE_AVATAR_ORIGIN}/api/start-session`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: request.body,
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
