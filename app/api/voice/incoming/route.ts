import {
  buildIncomingCallTwiML,
  buildVoicemailTwiML,
  formValue,
  twimlResponse,
  validateTwilioWebhook,
  voiceRouteUrls,
} from "@/src/lib/twilioVoiceWebhooks";
import { upsertIncomingVoiceCall } from "@/src/lib/voiceCallContext";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  // Recording-status callbacks do not include From. Save it now from the
  // signed incoming webhook so later voicemail notifications have the caller.
  const callContext = await upsertIncomingVoiceCall({
    callSid: formValue(webhook.params, "CallSid"),
    callerPhone: formValue(webhook.params, "From"),
  }).catch(() => ({ ok: false, status: 0, detail: "voice_call_context_failed", context: null }));
  if (!callContext.ok) {
    return new Response("Voice call context is temporarily unavailable.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  try {
    return twimlResponse(buildIncomingCallTwiML(voiceRouteUrls(request.url)));
  } catch {
    try {
      return twimlResponse(buildVoicemailTwiML(voiceRouteUrls(request.url), true));
    } catch {
      return twimlResponse(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>WildWorks phone service is temporarily unavailable. Please try again shortly.</Say><Hangup/></Response>",
      );
    }
  }
}
