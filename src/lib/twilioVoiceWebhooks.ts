import twilio from "twilio";

const DEFAULT_TTS_PROVIDER = "ElevenLabs";
const ALLOWED_TTS_PROVIDERS = new Set(["ElevenLabs", "Google", "Amazon"]);
const PRODUCTION_VOICE_HOSTS = new Set(["wildworks.live", "www.wildworks.live"]);
const PRODUCTION_WSS_HOST = "wildworks-iscott-voice.onrender.com";
const PRODUCTION_WSS_PATH = "/twilio/conversationrelay";

export const WILDWORKS_AI_DISCLOSURE =
  "Welcome to WildWorks. I'm iScott, Scott's Ai assistant, here to help you. " +
  "With your permission, our conversation may be processed by Ai, transcribed, and saved.";

export const WILDWORKS_MENU_PROMPT =
  "Press 1 to continue talking to iScott, or press 2 to leave a voice mail for the real Scott, " +
  "who will promptly be back in touch with you.";

export const ISCOTT_WELCOME_GREETING =
  "Hello, I'm iScott, Scott's Ai assistant at WildWorks. How can I help you today?";

export const WILDWORKS_VOICEMAIL_GREETING =
  "Okay, you've reached the WildWorks voicemail for Scott. After the tone, please leave your " +
  "name, phone number, where the project is located, and a brief description of what you have " +
  "in mind. Your message may be transcribed to help Scott follow up. He'll be in touch promptly.";

type TwilioFormValue = string | string[];
export type TwilioFormParams = Record<string, TwilioFormValue>;

export type ValidatedTwilioWebhook = {
  ok: true;
  params: TwilioFormParams;
  signedUrl: string;
};

export type RejectedTwilioWebhook = {
  ok: false;
  response: Response;
};

export type VoiceRouteUrls = {
  menu: string;
  conversationEnded: string;
  voicemail: string;
  voicemailFinished: string;
  recordingComplete: string;
  transcriptionComplete: string;
};

export type ConversationRelayConfig = {
  publicWssUrl: string | null;
  actionUrl: string;
  ttsProvider: "ElevenLabs" | "Google" | "Amazon";
  voice?: string;
};

export type ConversationRelayHandoff = {
  target: string | null;
  summary: string | null;
  data: Record<string, unknown>;
};

function plainResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function twimlResponse(xml: string, status = 200): Response {
  return new Response(xml, {
    status,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseFormBody(rawBody: string): TwilioFormParams {
  const parsed = new URLSearchParams(rawBody);
  const result: TwilioFormParams = {};
  parsed.forEach((value, key) => {
    const current = result[key];
    if (current === undefined) {
      result[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      result[key] = [current, value];
    }
  });
  return result;
}

function configuredPublicBaseUrl(): URL | null {
  const configured = process.env.TWILIO_VOICE_PUBLIC_BASE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.port ||
      url.pathname !== "/" ||
      (process.env.NODE_ENV === "production" && !PRODUCTION_VOICE_HOSTS.has(url.hostname))
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export function publicTwilioWebhookUrl(requestUrl: string): string {
  const incoming = new URL(requestUrl);
  const configuredBase = configuredPublicBaseUrl();
  if (!configuredBase) return incoming.toString();
  return new URL(`${incoming.pathname}${incoming.search}`, configuredBase.origin).toString();
}

export async function validateTwilioWebhook(
  request: Request,
): Promise<ValidatedTwilioWebhook | RejectedTwilioWebhook> {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    return { ok: false, response: plainResponse("Voice webhook is not configured.", 503) };
  }
  if (process.env.NODE_ENV === "production" && !configuredPublicBaseUrl()) {
    return { ok: false, response: plainResponse("Voice webhook is not configured.", 503) };
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return { ok: false, response: plainResponse("Unsupported webhook content type.", 415) };
  }

  const signature = request.headers.get("x-twilio-signature")?.trim();
  if (!signature) {
    return { ok: false, response: plainResponse("Forbidden.", 403) };
  }

  const rawBody = await request.text();
  const params = parseFormBody(rawBody);
  const signedUrl = publicTwilioWebhookUrl(request.url);
  if (!twilio.validateRequest(authToken, signature, signedUrl, params)) {
    return { ok: false, response: plainResponse("Forbidden.", 403) };
  }

  const configuredAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const requestAccountSid = formValue(params, "AccountSid");
  if (configuredAccountSid && requestAccountSid && requestAccountSid !== configuredAccountSid) {
    return { ok: false, response: plainResponse("Forbidden.", 403) };
  }

  return { ok: true, params, signedUrl };
}

export function formValue(params: TwilioFormParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function routeUrl(requestUrl: string, path: string): string {
  const base = configuredPublicBaseUrl() ?? new URL(requestUrl);
  return new URL(path, base.origin).toString();
}

export function voiceRouteUrls(requestUrl: string): VoiceRouteUrls {
  return {
    menu: routeUrl(requestUrl, "/api/voice/menu"),
    conversationEnded: routeUrl(requestUrl, "/api/voice/conversation-ended"),
    voicemail: routeUrl(requestUrl, "/api/voice/voicemail"),
    voicemailFinished: routeUrl(requestUrl, "/api/voice/voicemail-finished"),
    recordingComplete: routeUrl(requestUrl, "/api/voice/recording-complete"),
    transcriptionComplete: routeUrl(requestUrl, "/api/voice/transcription-complete"),
  };
}

function validWssUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "wss:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.port ||
      (process.env.NODE_ENV === "production" &&
        (url.hostname !== PRODUCTION_WSS_HOST || url.pathname !== PRODUCTION_WSS_PATH))
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function configuredTtsProvider(): "ElevenLabs" | "Google" | "Amazon" {
  const configured = process.env.TWILIO_CONVERSATION_RELAY_TTS_PROVIDER?.trim();
  return configured && ALLOWED_TTS_PROVIDERS.has(configured)
    ? (configured as "ElevenLabs" | "Google" | "Amazon")
    : DEFAULT_TTS_PROVIDER;
}

export function conversationRelayConfig(requestUrl: string): ConversationRelayConfig {
  const internalActionUrl = voiceRouteUrls(requestUrl).conversationEnded;
  const voice = process.env.TWILIO_CONVERSATION_RELAY_VOICE?.trim();
  return {
    publicWssUrl: validWssUrl(process.env.PUBLIC_WSS_URL),
    actionUrl: internalActionUrl,
    ttsProvider: configuredTtsProvider(),
    ...(voice ? { voice } : {}),
  };
}

export function buildIncomingCallTwiML(urls: VoiceRouteUrls): string {
  const response = new twilio.twiml.VoiceResponse();
  // The disclosure is intentionally outside Gather so a quick keypress cannot
  // skip identity, AI-processing, transcription, or storage notice.
  response.say(WILDWORKS_AI_DISCLOSURE);
  const gather = response.gather({
    action: urls.menu,
    actionOnEmptyResult: true,
    input: ["dtmf"],
    method: "POST",
    numDigits: 1,
    timeout: 8,
  });
  gather.say(WILDWORKS_MENU_PROMPT);
  response.redirect({ method: "POST" }, urls.voicemail);
  return response.toString();
}

export function buildVoicemailTwiML(urls: VoiceRouteUrls, unavailable = false): string {
  const response = new twilio.twiml.VoiceResponse();
  if (unavailable) {
    response.say("iScott is not available right now. You can still leave a WildWorks voicemail.");
  }
  response.say(WILDWORKS_VOICEMAIL_GREETING);
  response.record({
    action: urls.voicemailFinished,
    finishOnKey: "#",
    // Twilio native transcription accepts recordings longer than 2 seconds and
    // shorter than 120 seconds. Keep this below the provider's hard limit.
    maxLength: 119,
    method: "POST",
    playBeep: true,
    recordingStatusCallback: urls.recordingComplete,
    recordingStatusCallbackEvent: ["completed", "absent"],
    recordingStatusCallbackMethod: "POST",
    timeout: 8,
    transcribe: true,
    transcribeCallback: urls.transcriptionComplete,
    trim: "trim-silence",
  });
  return response.toString();
}

export function buildConversationRelayTwiML(config: ConversationRelayConfig): string | null {
  if (!config.publicWssUrl) return null;
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect({ action: config.actionUrl, method: "POST" });
  connect.conversationRelay({
    url: config.publicWssUrl,
    language: "en-US",
    ttsProvider: config.ttsProvider,
    ...(config.voice ? { voice: config.voice } : {}),
    welcomeGreeting: ISCOTT_WELCOME_GREETING,
    welcomeGreetingInterruptible: "any",
  });
  return response.toString();
}

export function buildMenuSelectionTwiML(
  digit: string | null,
  urls: VoiceRouteUrls,
  relayConfig: ConversationRelayConfig,
): string {
  if (digit === "1") {
    return buildConversationRelayTwiML(relayConfig) ?? buildVoicemailTwiML(urls, true);
  }
  return buildVoicemailTwiML(urls);
}

export function buildVoicemailFinishedTwiML(): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say("Thank you. Your WildWorks voicemail has been received. Goodbye.");
  response.hangup();
  return response.toString();
}

export function parseConversationRelayHandoffData(raw: string | null): ConversationRelayHandoff {
  if (!raw || raw.length > 8_000) return { target: null, summary: null, data: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { target: null, summary: null, data: {} };
    }
    const data = parsed as Record<string, unknown>;
    const target = typeof data.target === "string"
      ? data.target.trim().toLowerCase().slice(0, 80) || null
      : null;
    const summary = typeof data.summary === "string"
      ? data.summary.replace(/\s+/g, " ").trim().slice(0, 3_000) || null
      : null;
    return { target, summary, data };
  } catch {
    return { target: null, summary: null, data: {} };
  }
}

export function buildHangupTwiML(): string {
  const response = new twilio.twiml.VoiceResponse();
  response.hangup();
  return response.toString();
}

export function buildConversationEndedTwiML(
  handoff: ConversationRelayHandoff,
  urls: VoiceRouteUrls,
  outcome: { sessionStatus?: string | null; errorCode?: string | null } = {},
): string {
  const providerFailed = outcome.sessionStatus?.trim().toLowerCase() === "failed" ||
    Boolean(outcome.errorCode?.trim());
  return handoff.target === "voicemail" || providerFailed
    ? buildVoicemailTwiML(urls, providerFailed && handoff.target !== "voicemail")
    : buildHangupTwiML();
}
