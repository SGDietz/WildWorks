import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const MIN_SECRET_BYTES = 32;

class VoiceEventBodyTooLargeError extends Error {}

async function readVoiceEventBody(request: Request): Promise<ArrayBuffer> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new VoiceEventBodyTooLargeError();
  }
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new VoiceEventBodyTooLargeError();
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

export type VoiceEventType =
  | "session_start"
  | "user_message"
  | "assistant_message"
  | "session_end"
  | "handoff";

export type InternalVoiceEvent = {
  version: 1;
  eventId: string;
  eventType: VoiceEventType;
  occurredAt: string;
  callSid: string;
  sessionId: string;
  messageId?: string;
  text?: string;
  summary?: string;
  callerName?: string;
  callerPhone?: string;
  metadata?: Record<string, unknown>;
};

export type ValidatedVoiceEventRequest =
  | { ok: true; event: InternalVoiceEvent }
  | { ok: false; response: Response };

function secret(): string | null {
  const value = process.env.WILDWORKS_VOICE_EVENT_SECRET?.trim() ?? "";
  return Buffer.byteLength(value, "utf8") >= MIN_SECRET_BYTES ? value : null;
}

function safeEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function createVoiceEventSignature(
  rawBody: string | Uint8Array,
  timestamp: string,
  signingSecret = secret(),
): string | null {
  if (!signingSecret || Buffer.byteLength(signingSecret, "utf8") < MIN_SECRET_BYTES) return null;
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
  return `v1=${createHmac("sha256", signingSecret)
    .update(timestamp, "utf8")
    .update(".", "utf8")
    .update(body)
    .digest("hex")}`;
}

export function validateVoiceEventSignature(args: {
  rawBody: string | Uint8Array;
  timestamp: string | null;
  signature: string | null;
  nowSeconds?: number;
}): boolean {
  const signingSecret = secret();
  if (!signingSecret || !args.timestamp || !args.signature) return false;
  if (!/^\d{10}$/.test(args.timestamp) || !/^v1=[0-9a-f]{64}$/.test(args.signature)) return false;
  const timestamp = Number(args.timestamp);
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false;
  const expected = createVoiceEventSignature(args.rawBody, args.timestamp, signingSecret);
  return Boolean(expected) && safeEqual(expected!, args.signature);
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(cleaned)
    ? cleaned
    : null;
}

export function parseInternalVoiceEvent(value: unknown): InternalVoiceEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const eventTypes = new Set<VoiceEventType>([
    "session_start",
    "user_message",
    "assistant_message",
    "session_end",
    "handoff",
  ]);
  const eventType = input.eventType as VoiceEventType;
  const eventId = cleanString(input.eventId, 190);
  const callSid = cleanString(input.callSid, 34);
  const sessionId = cleanString(input.sessionId, 128);
  const occurredAt = cleanString(input.occurredAt, 40);
  if (
    input.version !== 1 ||
    !eventTypes.has(eventType) ||
    !eventId ||
    !callSid ||
    !/^CA[0-9a-fA-F]{32}$/.test(callSid) ||
    !sessionId ||
    !occurredAt ||
    Number.isNaN(Date.parse(occurredAt))
  ) {
    return null;
  }
  const isMessage = eventType === "user_message" || eventType === "assistant_message";
  const text = cleanString(input.text, 4_000);
  if (isMessage && !text) return null;
  const messageId = cleanString(input.messageId, 190);
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? (input.metadata as Record<string, unknown>)
    : undefined;
  return {
    version: 1,
    eventId,
    eventType,
    occurredAt: new Date(occurredAt).toISOString(),
    callSid,
    sessionId,
    ...(messageId ? { messageId } : {}),
    ...(text ? { text } : {}),
    ...(cleanString(input.summary, 3_000) ? { summary: cleanString(input.summary, 3_000)! } : {}),
    ...(cleanString(input.callerName, 180) ? { callerName: cleanString(input.callerName, 180)! } : {}),
    ...(cleanString(input.callerPhone, 80) ? { callerPhone: cleanString(input.callerPhone, 80)! } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export async function validateInternalVoiceEventRequest(
  request: Request,
): Promise<ValidatedVoiceEventRequest> {
  if (!(request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))) {
    return { ok: false, response: plain("Unsupported content type.", 415) };
  }
  let body: Uint8Array;
  try {
    body = new Uint8Array(await readVoiceEventBody(request));
  } catch (error) {
    return {
      ok: false,
      response: plain(error instanceof VoiceEventBodyTooLargeError ? "Request too large." : "Invalid request.", error instanceof VoiceEventBodyTooLargeError ? 413 : 400),
    };
  }
  if (!validateVoiceEventSignature({
    rawBody: body,
    timestamp: request.headers.get("x-wildworks-voice-timestamp"),
    signature: request.headers.get("x-wildworks-voice-signature"),
  })) {
    return { ok: false, response: plain("Forbidden.", 403) };
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return { ok: false, response: plain("Invalid request.", 400) };
  }
  const event = parseInternalVoiceEvent(decoded);
  return event
    ? { ok: true, event }
    : { ok: false, response: plain("Invalid event.", 400) };
}

export function validateInternalVoiceEventHead(request: Request): boolean {
  return validateVoiceEventSignature({
    rawBody: new Uint8Array(),
    timestamp: request.headers.get("x-wildworks-voice-timestamp"),
    signature: request.headers.get("x-wildworks-voice-signature"),
  });
}
