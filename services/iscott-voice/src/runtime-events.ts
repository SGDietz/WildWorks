import { createHash, createHmac } from "node:crypto";
import type { SafeLogger } from "./types.ts";

export const VOICE_EVENT_VERSION = 1 as const;

export type VoiceEventType =
  | "session_start"
  | "user_message"
  | "assistant_message"
  | "session_end"
  | "handoff";

export interface VoiceRuntimeEvent {
  version: typeof VOICE_EVENT_VERSION;
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
  metadata?: Record<string, boolean | number | string>;
}

export interface RuntimeEventPublisher {
  publish(event: VoiceRuntimeEvent): Promise<boolean>;
}

export interface HmacRuntimeEventPublisherOptions {
  endpointUrl: string;
  secret: string;
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  logger: SafeLogger;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function sha256(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    const encoded = Buffer.from(part, "utf8");
    hash.update(String(encoded.length), "utf8");
    hash.update(":", "utf8");
    hash.update(encoded);
    hash.update("|", "utf8");
  }
  return hash.digest("hex");
}

/**
 * Returns a content-safe, deterministic idempotency key. Raw caller content is
 * hashed into the key but never appears in it or in service logs.
 */
export function deterministicVoiceId(
  namespace: "event" | "message",
  ...parts: readonly string[]
): string {
  return `ww_voice_v1_${namespace}_${sha256(parts)}`;
}

export function signVoiceEvent(secret: string, timestamp: string, rawBody: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `v1=${digest}`;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Posts one stable JSON body with a fresh signed timestamp on each attempt.
 * It never logs the body, ids, call SIDs, phone numbers, transcripts, or secret.
 */
export class HmacRuntimeEventPublisher implements RuntimeEventPublisher {
  private readonly options: HmacRuntimeEventPublisherOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly nowMs: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: HmacRuntimeEventPublisherOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.nowMs = options.nowMs ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * Verifies that the authenticated WildWorks event receiver and its storage
   * dependencies are ready without creating an event or exposing call data.
   */
  async healthCheck(): Promise<void> {
    const timestamp = Math.floor(this.nowMs() / 1_000).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    timer.unref?.();
    try {
      const response = await this.fetchImpl(this.options.endpointUrl, {
        method: "HEAD",
        headers: {
          "x-wildworks-voice-signature": signVoiceEvent(
            this.options.secret,
            timestamp,
            "",
          ),
          "x-wildworks-voice-timestamp": timestamp,
        },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.status !== 204) {
        throw new Error(`Voice event receiver health status ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async publish(event: VoiceRuntimeEvent): Promise<boolean> {
    const rawBody = JSON.stringify(event);
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      const timestamp = Math.floor(this.nowMs() / 1_000).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      timer.unref?.();
      try {
        const response = await this.fetchImpl(this.options.endpointUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-wildworks-voice-signature": signVoiceEvent(
              this.options.secret,
              timestamp,
              rawBody,
            ),
            "x-wildworks-voice-timestamp": timestamp,
          },
          body: rawBody,
          redirect: "error",
          signal: controller.signal,
        });
        if (response.ok) {
          this.options.logger.info("voice_event_delivered", {
            attempt,
            eventType: event.eventType,
          });
          return true;
        }
        this.options.logger.warn("voice_event_rejected", {
          attempt,
          eventType: event.eventType,
          status: response.status,
        });
        if (!isRetryableStatus(response.status)) return false;
      } catch (error) {
        this.options.logger.warn("voice_event_delivery_failed", {
          attempt,
          eventType: event.eventType,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
      } finally {
        clearTimeout(timer);
      }

      if (attempt < this.options.maxAttempts) {
        await this.sleep(this.options.retryBaseMs * 2 ** (attempt - 1));
      }
    }
    return false;
  }
}
