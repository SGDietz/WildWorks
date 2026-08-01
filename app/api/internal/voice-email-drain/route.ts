import {
  listStaleVoiceTranscriptions,
  markVoiceTranscriptionMissing,
} from "@/src/lib/voiceCallContext";
import { authorizeVoiceEmailDrainRequest } from "@/src/lib/voiceCronAuthorization";
import {
  drainVoiceEmailOutbox,
  notifyVoicemailByEmail,
} from "@/src/lib/voiceEmailNotifications";
import { createVoiceRecordingPlaybackUrl } from "@/src/lib/voiceRecordingPlayback";
import { voicemailFallbackEventId } from "@/src/lib/voiceNotificationIds";

export const runtime = "nodejs";

export function authorizeVoiceEmailDrain(request: Request): boolean {
  return authorizeVoiceEmailDrainRequest(request);
}

async function handle(request: Request): Promise<Response> {
  if (!authorizeVoiceEmailDrain(request)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const result = await drainVoiceEmailOutbox({ limit: 10 });
  const configuredGraceSeconds = Number(process.env.WILDWORKS_VOICE_TRANSCRIPTION_GRACE_SECONDS);
  const graceSeconds = Number.isFinite(configuredGraceSeconds)
    ? Math.min(3_600, Math.max(300, Math.floor(configuredGraceSeconds)))
    : 900;
  const stale = await listStaleVoiceTranscriptions(
    new Date(Date.now() - graceSeconds * 1000),
    10,
  );
  let transcriptionFallbacks = 0;
  let transcriptionFallbackErrors = stale.ok ? 0 : 1;
  if (stale.ok) {
    for (const context of stale.contexts) {
      if (!context.caller_phone) {
        transcriptionFallbackErrors += 1;
        continue;
      }
      const playbackUrl = context.recording_sid
        ? createVoiceRecordingPlaybackUrl(context.recording_sid, request.url)
        : null;
      if (context.recording_sid && !playbackUrl) {
        transcriptionFallbackErrors += 1;
        continue;
      }
      const failureMessage = context.recording_status === "absent"
        ? "No audio recording was received, so no transcript could be created."
        : context.recording_status === "failed"
          ? "The voicemail recording failed, so no transcript could be created."
          : context.recording_duration !== null && context.recording_duration <= 2
            ? "The voicemail was too short for Twilio to transcribe."
            : `No transcription callback was received within ${Math.round(graceSeconds / 60)} minutes.`;
      const notification = await notifyVoicemailByEmail({
        eventId: voicemailFallbackEventId(context.recording_sid, context.call_sid),
        externalCallId: context.call_sid,
        callerPhone: context.caller_phone,
        receivedAt: context.updated_at,
        transcriptionStatus: failureMessage,
        recordingReference: playbackUrl,
      });
      if (!notification.queued) {
        transcriptionFallbackErrors += 1;
        continue;
      }
      const marked = await markVoiceTranscriptionMissing(context.call_sid, context.updated_at);
      if (!marked.ok) {
        transcriptionFallbackErrors += 1;
        continue;
      }
      transcriptionFallbacks += 1;
    }
  }
  const ok = result.ok && transcriptionFallbackErrors === 0;
  return Response.json(
    {
      ok,
      examined: result.examined,
      claimed: result.claimed,
      delivered: result.delivered,
      failed: result.failed,
      skipped: result.skipped,
      transcriptionFallbacks,
      transcriptionFallbackErrors,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const GET = handle;
export const POST = handle;
