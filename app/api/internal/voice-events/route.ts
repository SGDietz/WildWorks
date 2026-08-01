import { getVoiceCallContext } from "@/src/lib/voiceCallContext";
import {
  finalizeVoiceSession,
  insertDeduplicatedVoiceMessage,
  upsertVoiceSession,
} from "@/src/lib/voiceConversationPersistence";
import { notifyVoiceLeadByEmail } from "@/src/lib/voiceEmailNotifications";
import { voiceLeadNotificationEventId } from "@/src/lib/voiceNotificationIds";
import { probeVoiceEventDependencies } from "@/src/lib/voiceEventReadiness";
import {
  validateInternalVoiceEventHead,
  validateInternalVoiceEventRequest,
} from "@/src/lib/voiceEventSecurity";

export const runtime = "nodejs";

function resultResponse(ok: boolean, status = ok ? 204 : 503): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const validated = await validateInternalVoiceEventRequest(request);
  if (!validated.ok) return validated.response;
  const event = validated.event;
  const baseMetadata = { ...event.metadata, voiceEventId: event.eventId, voiceEventType: event.eventType };

  if (event.eventType === "session_start") {
    const result = await upsertVoiceSession({
      sessionId: event.sessionId,
      externalCallId: event.callSid,
      startedAt: event.occurredAt,
      route: "twilio_conversationrelay",
      metadata: baseMetadata,
    });
    return resultResponse(result.ok);
  }

  if (event.eventType === "user_message" || event.eventType === "assistant_message") {
    const session = await upsertVoiceSession({
      sessionId: event.sessionId,
      externalCallId: event.callSid,
      route: "twilio_conversationrelay",
      metadata: baseMetadata,
    });
    if (!session.ok || !session.sessionId) return resultResponse(false);
    const message = await insertDeduplicatedVoiceMessage({
      sessionId: session.sessionId,
      providerMessageId: event.messageId ?? event.eventId,
      role: event.eventType === "user_message" ? "user" : "assistant",
      message: event.text!,
      source: "twilio_conversationrelay",
      route: "twilio_conversationrelay",
      createdAt: event.occurredAt,
      metadata: baseMetadata,
    });
    return resultResponse(message.ok);
  }

  const ensured = await upsertVoiceSession({
    sessionId: event.sessionId,
    externalCallId: event.callSid,
    route: "twilio_conversationrelay",
    metadata: baseMetadata,
  });
  if (!ensured.ok) return resultResponse(false);
  const finalized = await finalizeVoiceSession({
    sessionId: ensured.sessionId ?? event.sessionId,
    endedAt: event.occurredAt,
    metadata: baseMetadata,
  });
  if (!finalized.ok) return resultResponse(false);
  if (event.eventType === "handoff") return resultResponse(true);

  const context = await getVoiceCallContext({ callSid: event.callSid });
  if (!context.ok) return resultResponse(false);
  const callerPhone = context.context?.caller_phone ?? event.callerPhone ?? null;
  const notification = await notifyVoiceLeadByEmail({
    eventId: voiceLeadNotificationEventId(event.callSid),
    sessionId: finalized.sessionId,
    externalCallId: event.callSid,
    callerName: event.callerName,
    callerPhone,
    receivedAt: event.occurredAt,
    summary: event.summary,
    metadata: baseMetadata,
  });
  return resultResponse(notification.ok);
}

export async function HEAD(request: Request) {
  if (!validateInternalVoiceEventHead(request)) return new Response(null, { status: 403 });
  const ready = await probeVoiceEventDependencies();
  return new Response(null, {
    status: ready ? 204 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
