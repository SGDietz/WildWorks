import { createHmac, timingSafeEqual } from "node:crypto";

const RECORDING_SID_PATTERN = /^RE[0-9a-fA-F]{32}$/;
const DEFAULT_TTL_SECONDS = 86_400;
const MAX_TTL_SECONDS = 86_400;
const MIN_SECRET_BYTES = 32;

function playbackSecret(): string | null {
  const secret = process.env.WILDWORKS_VOICE_PLAYBACK_SECRET?.trim() ?? "";
  return Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES ? secret : null;
}

function signaturePayload(recordingSid: string, expiresAt: number): string {
  return `v1:${recordingSid}:${expiresAt}`;
}

function sign(recordingSid: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(signaturePayload(recordingSid, expiresAt), "utf8")
    .digest("base64url");
}

function configuredTtlSeconds(): number {
  const configured = Number(process.env.WILDWORKS_VOICE_PLAYBACK_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(60, Math.floor(configured)));
}

function safeEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function playbackOrigin(requestUrl?: string): URL | null {
  const configured = process.env.TWILIO_VOICE_PUBLIC_BASE_URL?.trim();
  const value = configured || requestUrl;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export type VoicePlaybackValidation =
  | { ok: true; recordingSid: string; expiresAt: number }
  | { ok: false; reason: "invalid" | "expired" | "not_configured" };

export function isValidTwilioRecordingSid(value: unknown): value is string {
  return typeof value === "string" && RECORDING_SID_PATTERN.test(value.trim());
}

export function createVoiceRecordingPlaybackUrl(
  recordingSid: string,
  requestUrl?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  const secret = playbackSecret();
  const origin = playbackOrigin(requestUrl);
  if (!secret || !origin || !isValidTwilioRecordingSid(recordingSid)) return null;
  const expiresAt = nowSeconds + configuredTtlSeconds();
  const url = new URL("/api/voice/recording", origin.origin);
  url.searchParams.set("sid", recordingSid.trim());
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", sign(recordingSid.trim(), expiresAt, secret));
  return url.toString();
}

export function validateVoiceRecordingPlayback(
  urlOrRequest: string | URL | Request,
  nowSeconds = Math.floor(Date.now() / 1000),
): VoicePlaybackValidation {
  const secret = playbackSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  let url: URL;
  try {
    url = urlOrRequest instanceof Request
      ? new URL(urlOrRequest.url)
      : urlOrRequest instanceof URL
        ? urlOrRequest
        : new URL(urlOrRequest);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const recordingSid = url.searchParams.get("sid")?.trim() ?? "";
  const expiresRaw = url.searchParams.get("exp")?.trim() ?? "";
  const suppliedSignature = url.searchParams.get("sig")?.trim() ?? "";
  if (
    !isValidTwilioRecordingSid(recordingSid) ||
    !/^\d{10}$/.test(expiresRaw) ||
    !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const expiresAt = Number(expiresRaw);
  const expectedSignature = sign(recordingSid, expiresAt, secret);
  if (!safeEqual(expectedSignature, suppliedSignature)) return { ok: false, reason: "invalid" };
  if (expiresAt < nowSeconds) return { ok: false, reason: "expired" };
  if (expiresAt > nowSeconds + MAX_TTL_SECONDS + 60) return { ok: false, reason: "invalid" };
  return { ok: true, recordingSid, expiresAt };
}
