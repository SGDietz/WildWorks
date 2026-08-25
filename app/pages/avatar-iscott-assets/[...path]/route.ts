const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";
const LOCAL_ASSET_PREFIX = "/pages/avatar-iscott-assets/_next/";

// 2026-08-24. This route fetched ANY path from a third party and served the
// result from wildworks' own address, so a visitor's browser trusted it as
// first-party. No timeout, no size limit, no restriction on what could come
// back. It still is not version-pinned - that is a bigger job - but it can no
// longer be pointed at arbitrary content.
const REMOTE_TIMEOUT_MS = 8_000;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ASSET_EXTENSIONS = /\.(js|mjs|css|json|map|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico|mp4|webm|wasm)$/i;
const ALLOWED_CONTENT_TYPE =
  /^(application\/(javascript|json|wasm|octet-stream)|text\/(javascript|css|plain)|image\/|font\/|video\/|audio\/)/i;

/** Only build assets. Not pages, not API routes, not redirects. */
function isAllowedAssetPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((seg) => seg === ".." || seg === "." || seg.includes("\\"))) return false;
  if (segments[0] === "_next") return true;
  return ASSET_EXTENSIONS.test(segments[segments.length - 1]);
}

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
  if (!isAllowedAssetPath(path)) {
    return new Response("Not found", { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const remoteUrl = new URL(`/${path.map(encodeURIComponent).join("/")}`, REMOTE_AVATAR_ORIGIN);
  remoteUrl.search = incomingUrl.search;

  let response: Response;
  try {
    response = await fetch(remoteUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
    });
  } catch {
    return new Response("Upstream asset unavailable", { status: 504 });
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPE.test(contentType)) {
    return new Response("Unsupported asset type", { status: 415 });
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_ASSET_BYTES) {
    return new Response("Asset too large", { status: 502 });
  }
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
