import {
  buildVoicemailFinishedTwiML,
  twimlResponse,
  validateTwilioWebhook,
} from "@/src/lib/twilioVoiceWebhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  return twimlResponse(buildVoicemailFinishedTwiML());
}
