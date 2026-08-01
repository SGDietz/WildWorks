export type VoiceRecordingDecision =
  | { kind: "await_transcription" }
  | { kind: "notify_failure"; message: string }
  | { kind: "ignore" };

export type VoiceTranscriptionDecision =
  | { kind: "success"; transcript: string }
  | { kind: "failure"; message: string }
  | { kind: "ignore" };

export function classifyVoiceRecordingCallback(
  status: string | null,
  duration: string | null,
): VoiceRecordingDecision {
  const normalizedStatus = status?.trim().toLowerCase() ?? "";
  if (normalizedStatus === "absent") {
    return {
      kind: "notify_failure",
      message: "No audio recording was received, so no transcript could be created.",
    };
  }
  if (normalizedStatus && normalizedStatus !== "completed") {
    return normalizedStatus === "failed"
      ? { kind: "notify_failure", message: "The voicemail recording failed, so no transcript could be created." }
      : { kind: "ignore" };
  }
  if (normalizedStatus !== "completed") return { kind: "ignore" };
  const parsedDuration = Number(duration);
  if (Number.isFinite(parsedDuration) && parsedDuration >= 0 && parsedDuration <= 2) {
    return {
      kind: "notify_failure",
      message: "The voicemail was too short for Twilio to transcribe.",
    };
  }
  return { kind: "await_transcription" };
}

export function classifyVoiceTranscriptionCallback(
  status: string | null,
  text: string | null,
): VoiceTranscriptionDecision {
  const normalizedStatus = status?.trim().toLowerCase() ?? "";
  const transcript = text?.trim() ?? "";
  if (normalizedStatus === "completed") {
    return transcript
      ? { kind: "success", transcript }
      : { kind: "failure", message: "Twilio completed transcription but returned no transcript text." };
  }
  if (normalizedStatus === "failed") {
    return { kind: "failure", message: "Twilio could not transcribe this voicemail." };
  }
  return { kind: "ignore" };
}
