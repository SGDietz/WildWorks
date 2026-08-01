import { getVoiceCallContext } from "@/src/lib/voiceCallContext";
import { finalizeVoiceSession, upsertVoiceSession } from "@/src/lib/voiceConversationPersistence";
import { notifyVoiceLeadByEmail } from "@/src/lib/voiceEmailNotifications";
import { voiceLeadNotificationEventId } from "@/src/lib/voiceNotificationIds";
import {
  buildConversationEndedTwiML,
  formValue,
  parseConversationRelayHandoffData,
  twimlResponse,
  validateTwilioWebhook,
  voiceRouteUrls,
} from "@/src/lib/twilioVoiceWebhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  const callSid = formValue(webhook.params, "CallSid");
  if (!callSid || !/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
    return new Response("Invalid ConversationRelay callback.", { status: 400 });
  }
  const sessionId = formValue(webhook.params, "SessionId") ?? `voice-${callSid}`;
  const sessionStatus = formValue(webhook.params, "SessionStatus");
  const sessionDuration = formValue(webhook.params, "SessionDuration");
  const rawErrorCode = formValue(webhook.params, "ErrorCode");
  const errorCode = rawErrorCode && /^[0-9A-Za-z_-]{1,32}$/.test(rawErrorCode)
    ? rawErrorCode
    : rawErrorCode
      ? "provider_error"
      : null;
  const handoff = parseConversationRelayHandoffData(formValue(webhook.params, "HandoffData"));
  const outcome = { sessionStatus, errorCode: rawErrorCode };
  const fallbackTwiML = () =>
    twimlResponse(buildConversationEndedTwiML(handoff, voiceRouteUrls(request.url), outcome));
  const providerFailed = sessionStatus?.trim().toLowerCase() === "failed" || Boolean(rawErrorCode);
  const endedAt = new Date();
  const metadata = {
    sessionStatus,
    sessionDuration,
    errorCode,
    handoffTarget: handoff.target,
  };

  const ensured = await upsertVoiceSession({
    sessionId,
    externalCallId: callSid,
    route: "twilio_conversationrelay",
    metadata,
  });
  if (!ensured.ok) return providerFailed ? fallbackTwiML() : new Response(null, { status: 503 });
  const finalized = await finalizeVoiceSession({
    sessionId: ensured.sessionId ?? sessionId,
    endedAt,
    metadata,
  });
  if (!finalized.ok) return providerFailed ? fallbackTwiML() : new Response(null, { status: 503 });

  const context = await getVoiceCallContext({ callSid });
  if (!context.ok) return providerFailed ? fallbackTwiML() : new Response(null, { status: 503 });
  const callerPhone = context.context?.caller_phone ?? formValue(webhook.params, "From");
  const fallbackSummary = [
    sessionStatus ? `Conversation status: ${sessionStatus}.` : null,
    sessionDuration ? `Duration: ${sessionDuration} seconds.` : null,
  ].filter(Boolean).join(" ") || null;
  const summary = handoff.summary ?? fallbackSummary;
  const notification = await notifyVoiceLeadByEmail({
    eventId: voiceLeadNotificationEventId(callSid),
    sessionId: finalized.sessionId,
    externalCallId: callSid,
    callerPhone,
    receivedAt: endedAt,
    summary,
    metadata,
  });
  if (!notification.ok) return providerFailed ? fallbackTwiML() : new Response(null, { status: 503 });

  return fallbackTwiML();
}
