const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_SID_PATTERN = /^AC[0-9a-fA-F]{32}$/;
const PRODUCTION_WSS_URL =
  "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay";
const PRODUCTION_BASE_URLS = new Set([
  "https://wildworks.live",
  "https://www.wildworks.live",
]);

function value(env: NodeJS.ProcessEnv, name: string): string {
  return env[name]?.trim() ?? "";
}

function secretReady(env: NodeJS.ProcessEnv, name: string, minimum = 32): boolean {
  const secret = value(env, name);
  return Buffer.byteLength(secret, "utf8") >= minimum &&
    Buffer.byteLength(secret, "utf8") <= 512;
}

export function voiceRuntimeEnvironmentReady(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const fromEmail = value(env, "RESEND_FROM_EMAIL");
  const notifyEmail = value(env, "WILDWORKS_VOICE_NOTIFY_EMAIL");
  const publicBase = value(env, "TWILIO_VOICE_PUBLIC_BASE_URL").replace(/\/$/, "");
  const voice = value(env, "TWILIO_CONVERSATION_RELAY_VOICE");

  return ACCOUNT_SID_PATTERN.test(value(env, "TWILIO_ACCOUNT_SID")) &&
    secretReady(env, "TWILIO_AUTH_TOKEN", 16) &&
    PRODUCTION_BASE_URLS.has(publicBase) &&
    value(env, "PUBLIC_WSS_URL") === PRODUCTION_WSS_URL &&
    value(env, "TWILIO_CONVERSATION_RELAY_TTS_PROVIDER") === "ElevenLabs" &&
    voice.length > 0 &&
    voice.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(voice) &&
    secretReady(env, "RESEND_API_KEY", 16) &&
    EMAIL_PATTERN.test(fromEmail) &&
    EMAIL_PATTERN.test(notifyEmail) &&
    secretReady(env, "WILDWORKS_VOICE_EVENT_SECRET") &&
    secretReady(env, "WILDWORKS_VOICE_PLAYBACK_SECRET") &&
    secretReady(env, "WILDWORKS_VOICE_CRON_SECRET");
}
