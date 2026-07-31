const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";
const LOCAL_ASSET_PREFIX = "/pages/avatar-iscott-assets/_next/";

export const dynamic = "force-dynamic";

function rewriteRemoteAssetReferences(source: string) {
  return source
    .replaceAll("/_next/", LOCAL_ASSET_PREFIX)
    .replaceAll("\\/_next\\/", "\\/pages\\/avatar-iscott-assets\\/_next\\/");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const remoteUrl = new URL(`/${path.map(encodeURIComponent).join("/")}`, REMOTE_AVATAR_ORIGIN);
  remoteUrl.search = incomingUrl.search;

  const response = await fetch(remoteUrl, { cache: "no-store" });
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers({
    "Cache-Control": response.headers.get("cache-control") || "public, max-age=300",
    "Content-Type": contentType,
  });

  if (
    contentType.includes("javascript") ||
    contentType.startsWith("text/") ||
    contentType.includes("json")
  ) {
    return new Response(rewriteRemoteAssetReferences(await response.text()), {
      status: response.status,
      headers,
    });
  }

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers,
  });
}
