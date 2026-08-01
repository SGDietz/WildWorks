import type { ConversationRelayInbound } from "./types.ts";

const MAX_FRAME_CHARS = 65_536;

export function parseInboundFrame(raw: string): ConversationRelayInbound | null {
  if (raw.length === 0 || raw.length > MAX_FRAME_CHARS) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "setup") {
    return typeof candidate.sessionId === "string" && typeof candidate.accountSid === "string"
      ? (candidate as unknown as ConversationRelayInbound)
      : null;
  }
  if (candidate.type === "prompt") {
    return typeof candidate.voicePrompt === "string"
      ? (candidate as unknown as ConversationRelayInbound)
      : null;
  }
  if (candidate.type === "interrupt" || candidate.type === "error") {
    return candidate as unknown as ConversationRelayInbound;
  }
  return null;
}

const HUMAN_TRANSFER_PATTERNS = [
  /\b(?:speak|talk)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|representative|agent)\b/i,
  /\b(?:speak|talk)\s+(?:to|with)\s+someone\b/i,
  /\b(?:speak|talk)\s+(?:to|with)\s+(?:the\s+)?real\s+scott\b/i,
  /\b(?:speak|talk)\s+(?:to|with)\s+scott\b/i,
  /\b(?:human|live)\s+(?:agent|representative)\b/i,
  /\breal\s+person\b/i,
  /\b(?:i\s+(?:want|need)|get\s+me)\s+(?:a\s+)?(?:human|person|representative|agent)\b/i,
  /\btransfer\s+me\b/i,
  /\brequest\s+(?:a\s+)?human\s+transfer\b/i,
];

export function request_human_transfer(callerText: string): boolean {
  return HUMAN_TRANSFER_PATTERNS.some((pattern) => pattern.test(callerText));
}
