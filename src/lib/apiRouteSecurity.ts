/** Shared limits and validation for public API routes. */
const ALLOWED_ORIGINS = new Set([
  "https://wildworks.live",
  "https://www.wildworks.live",
  "https://wildworks.ai",
  "https://www.wildworks.ai",
  "https://wildworkslandscaping.com",
  "https://www.wildworkslandscaping.com",
]);

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function loopbackHostsMatch(incoming: URL, current: URL): boolean {
  return isLoopbackHostname(incoming.hostname) && isLoopbackHostname(current.hostname) && incoming.port === current.port;
}

function loopbackHostHeaderMatches(incoming: URL, request: Request): boolean {
  const host = request.headers.get("host");
  if (!host || !isLoopbackHostname(incoming.hostname)) return false;
  try {
    const hostUrl = new URL(`${incoming.protocol}//${host}`);
    return isLoopbackHostname(hostUrl.hostname) && incoming.port === hostUrl.port;
  } catch {
    return false;
  }
}

function originMatchesRequestHost(value: string, request: Request): boolean {
  try {
    const incoming = new URL(value);
    const current = new URL(request.url);
    return incoming.protocol === current.protocol && (incoming.host === current.host || loopbackHostsMatch(incoming, current) || loopbackHostHeaderMatches(incoming, request));
  } catch {
    return false;
  }
}

function isAllowedRequestOrigin(value: string, request: Request): boolean {
  return ALLOWED_ORIGINS.has(value) || originMatchesRequestHost(value, request);
}

export function assertAllowedOrigin(request: Request, options: { allowDirectNavigation?: boolean } = {}): Response | null {
  if (process.env.NODE_ENV !== "production") return null;

  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (isAllowedRequestOrigin(origin, request)) return null;
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    try {
      const refererUrl = new URL(referer);
      if (isAllowedRequestOrigin(refererUrl.origin, request)) return null;
    } catch {
      // Invalid referers are rejected below.
    }
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  if (options.allowDirectNavigation && request.method === "GET") return null;
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
}

export const MAX_TRANSCRIPTION_TEXT_CHARS = 4_000;
export const MAX_TRANSCRIPTION_SESSION_ID_CHARS = 128;
const SAFE_TRANSCRIPTION_SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/;

export function truncateUtf8String(input: string, maxChars: number): string {
  return input.length <= maxChars ? input : input.slice(0, maxChars);
}

export function isSafeTranscriptionSessionId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 8 || v.length > MAX_TRANSCRIPTION_SESSION_ID_CHARS) return false;
  return SAFE_TRANSCRIPTION_SESSION_ID.test(v);
}

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readLimitedRequestBody(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
