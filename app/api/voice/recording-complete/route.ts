import { upsertVoiceRecording } from "@/src/lib/voiceCallContext";
import { classifyVoiceRecordingCallback } from "@/src/lib/voiceVoicemailCallbacks";
import {
  formValue,
  validateTwilioWebhook,
} from "@/src/lib/twilioVoiceWebhooks";

export const runtime = "nodejs";

function callbackResponse(status = 204): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const webhook = await validateTwilioWebhook(request);
  if (!webhook.ok) return webhook.response;

  const recordingStatus = formValue(webhook.params, "RecordingStatus");
  const recordingSid = formValue(webhook.params, "RecordingSid");
  const callSid = formValue(webhook.params, "CallSid");
  const recordingDuration = formValue(webhook.params, "RecordingDuration");
  const decision = classifyVoiceRecordingCallback(recordingStatus, recordingDuration);
  if (decision.kind === "ignore") return callbackResponse();

  const persisted = await upsertVoiceRecording({
    callSid,
    recordingSid,
    status: recordingStatus,
    duration: recordingDuration,
  });
  // This callback only persists context. The transcription callback owns the
  // one immediate email; the authenticated drain sends a delayed fallback for
  // absent, too-short, failed, or missing transcriptions.
  return callbackResponse(persisted.ok ? 204 : 503);
}
