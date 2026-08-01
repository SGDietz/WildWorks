import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_BYTES = 32;

function validSecret(value: string | undefined): string | null {
  const secret = value?.trim() ?? "";
  return Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES ? secret : null;
}

function safeEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * Render uses WILDWORKS_VOICE_CRON_SECRET while Vercel Cron sends CRON_SECRET.
 * Accept either independently so configuring the Render secret cannot disable
 * the Vercel daily backstop.
 */
export function authorizeVoiceEmailDrainRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!supplied) return false;

  const renderSecret = validSecret(env.WILDWORKS_VOICE_CRON_SECRET);
  const vercelSecret = validSecret(env.CRON_SECRET);
  return Boolean(
    (renderSecret && safeEqual(renderSecret, supplied)) ||
    (vercelSecret && safeEqual(vercelSecret, supplied)),
  );
}
