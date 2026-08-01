import {
  buildMenuSelectionTwiML,
  buildVoicemailTwiML,
  conversationRelayConfig,
  formValue,
  twimlResponse,
  validateTwilioWebhook,
  voiceRouteUrls,
} from "@/src/lib/twilioVoiceWebhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  const urls = voiceRouteUrls(request.url);
  try {
    return twimlResponse(
      buildMenuSelectionTwiML(
        formValue(webhook.params, "Digits"),
        urls,
        conversationRelayConfig(request.url),
      ),
    );
  } catch {
    return twimlResponse(buildVoicemailTwiML(urls, true));
  }
}
