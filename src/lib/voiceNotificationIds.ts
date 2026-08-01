export function voiceLeadNotificationEventId(callSid: string): string {
  return `call:${callSid}`;
}

export function voiceLeadEmailIdempotencyKey(eventId: string): string {
  return `voice-lead:${eventId}`;
}

export function voicemailEmailIdempotencyKey(eventId: string): string {
  return `voicemail:${eventId}`;
}

export function voicemailTranscriptEventId(
  transcriptionSid: string | null,
  recordingSid: string,
): string {
  return `transcript:${transcriptionSid ?? recordingSid}`;
}

export function voicemailFallbackEventId(recordingSid: string | null, callSid: string): string {
  return recordingSid
    ? `fallback:${recordingSid}`
    : `fallback:recording-absent:${callSid}`;
}
