import { getVoiceCallContext, upsertVoiceTranscription } from "@/src/lib/voiceCallContext";
import { notifyVoicemailByEmail } from "@/src/lib/voiceEmailNotifications";
import { voicemailTranscriptEventId } from "@/src/lib/voiceNotificationIds";
import { createVoiceRecordingPlaybackUrl } from "@/src/lib/voiceRecordingPlayback";
import { classifyVoiceTranscriptionCallback } from "@/src/lib/voiceVoicemailCallbacks";
import { formValue, validateTwilioWebhook } from "@/src/lib/twilioVoiceWebhooks";

export const runtime = "nodejs";

function callbackResponse(status = 204): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  const callSid = formValue(webhook.params, "CallSid");
  const recordingSid = formValue(webhook.params, "RecordingSid");
  const transcriptionSid = formValue(webhook.params, "TranscriptionSid");
  const transcriptionStatus = formValue(webhook.params, "TranscriptionStatus");
  const transcriptionText = formValue(webhook.params, "TranscriptionText");
  const decision = classifyVoiceTranscriptionCallback(transcriptionStatus, transcriptionText);
  if (decision.kind === "ignore") return callbackResponse();

  const persisted = await upsertVoiceTranscription({
    callSid,
    recordingSid,
    transcriptionSid,
    status: transcriptionStatus,
    text: transcriptionText,
    // Native transcription callbacks are signed and normally include From,
    // but persisted incoming-call context remains the preferred source.
    callerPhone: formValue(webhook.params, "From"),
  });
  if (!persisted.ok) return callbackResponse(503);

  const context = persisted.context?.caller_phone
    ? persisted
    : await getVoiceCallContext({ callSid, recordingSid });
  const callerPhone = context.context?.caller_phone ?? formValue(webhook.params, "From");
  if (!context.ok || !callerPhone || !recordingSid) return callbackResponse(503);

  const playbackUrl = createVoiceRecordingPlaybackUrl(recordingSid, request.url);
  if (!playbackUrl) return callbackResponse(503);

  const result = await notifyVoicemailByEmail({
    eventId: voicemailTranscriptEventId(transcriptionSid, recordingSid),
    externalCallId: callSid,
    callerPhone,
    receivedAt: new Date(),
    ...(decision.kind === "success"
      ? { voicemailText: decision.transcript }
      : { transcriptionStatus: decision.message }),
    recordingReference: playbackUrl,
  });
  return callbackResponse(result.ok ? 204 : 503);
}
