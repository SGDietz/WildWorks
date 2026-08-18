export type TranscriptInsertClass =
  | "conflict_ok"
  | "on_conflict_mismatch"
  | "store_error";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LONG_DIGIT = /\+?\d[\d\s().-]{8,}\d/g;

export function sanitizeStoreErrorDetail(raw: string): string {
  return raw
    .replace(EMAIL, "[redacted-email]")
    .replace(LONG_DIGIT, "[redacted-number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function classifyTranscriptInsertFailure(status: number, body: string): {
  kind: TranscriptInsertClass;
  treatAsStored: boolean;
} {
  const text = body.toLowerCase();
  if (status === 409 || text.includes("23505") || text.includes("duplicate key")) {
    return { kind: "conflict_ok", treatAsStored: true };
  }
  if (
    status === 400 &&
    (text.includes("on conflict") ||
      text.includes("42p10") ||
      text.includes("no unique or exclusion constraint"))
  ) {
    return { kind: "on_conflict_mismatch", treatAsStored: false };
  }
  return { kind: "store_error", treatAsStored: false };
}

export function nextSyncBackoffMs(consecutiveFailures: number): number {
  const n = Math.max(0, Math.min(consecutiveFailures - 1, 4));
  return Math.min(60_000, 5_000 * 2 ** n);
}

export function shouldAdvanceTranscriptCursor(args: {
  httpOk: boolean;
  storeFailed?: boolean;
}): boolean {
  return args.httpOk && !args.storeFailed;
}
