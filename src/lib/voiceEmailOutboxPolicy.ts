export type VoiceEmailOutboxTimingRow = {
  status: "pending" | "sending" | "sent" | "failed";
  updated_at: string;
  lease_expires_at: string | null;
  next_attempt_at: string | null;
};

export const VOICE_EMAIL_OUTBOX_STALE_MS = 10 * 60 * 1000;

function parsedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isVoiceEmailOutboxRowDue(
  row: VoiceEmailOutboxTimingRow,
  nowMs = Date.now(),
): boolean {
  if (row.status === "pending") return (parsedTime(row.next_attempt_at) ?? 0) <= nowMs;
  if (row.status === "failed") return (parsedTime(row.next_attempt_at) ?? 0) <= nowMs;
  if (row.status !== "sending") return false;
  const leaseExpired = (parsedTime(row.lease_expires_at) ?? 0) <= nowMs;
  const staleUpdate = (parsedTime(row.updated_at) ?? 0) <= nowMs - VOICE_EMAIL_OUTBOX_STALE_MS;
  return leaseExpired || staleUpdate;
}

export function voiceEmailRetryDelayMs(attemptCount: number): number {
  const attempt = Math.max(1, Math.floor(attemptCount));
  return Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.min(9, attempt - 1));
}
