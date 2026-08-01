import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  deterministicVoiceId,
  HmacRuntimeEventPublisher,
  VOICE_EVENT_VERSION,
  type VoiceRuntimeEvent,
} from "../src/runtime-events.ts";
import type { SafeLogFields, SafeLogger } from "../src/types.ts";

class MockLogger implements SafeLogger {
  entries: Array<{ level: string; event: string; fields?: SafeLogFields }> = [];
  info(event: string, fields?: SafeLogFields): void {
    this.entries.push({ level: "info", event, ...(fields ? { fields } : {}) });
  }
  warn(event: string, fields?: SafeLogFields): void {
    this.entries.push({ level: "warn", event, ...(fields ? { fields } : {}) });
  }
  error(event: string, fields?: SafeLogFields): void {
    this.entries.push({ level: "error", event, ...(fields ? { fields } : {}) });
  }
}

const privateText = "My private project is at +15555550123";
const sampleEvent: VoiceRuntimeEvent = {
  version: VOICE_EVENT_VERSION,
  eventId: deterministicVoiceId("event", "call", "session", "user_message", privateText),
  eventType: "user_message",
  occurredAt: "2026-08-01T16:00:00.000Z",
  callSid: `CA${"a".repeat(32)}`,
  sessionId: "session-one",
  messageId: deterministicVoiceId("message", "call", "session", "user", privateText),
  text: privateText,
};

test("signs the exact raw v1 body contract and retries only with bounded attempts", async () => {
  const secret = "s".repeat(32);
  const nowMs = Date.parse("2026-08-01T16:00:00.000Z");
  const requests: Array<{ body: string; headers: Headers }> = [];
  let calls = 0;
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    requests.push({
      body: String(init?.body ?? ""),
      headers: new Headers(init?.headers),
    });
    return new Response(null, { status: calls === 1 ? 503 : 204 });
  }) as typeof fetch;
  const log = new MockLogger();
  const sleeps: number[] = [];
  const publisher = new HmacRuntimeEventPublisher({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-events",
    secret,
    timeoutMs: 100,
    maxAttempts: 3,
    retryBaseMs: 25,
    logger: log,
    fetchImpl,
    nowMs: () => nowMs,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
  });

  assert.equal(await publisher.publish(sampleEvent), true);
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [25]);
  const rawBody = JSON.stringify(sampleEvent);
  const timestamp = String(Math.floor(nowMs / 1_000));
  const expected = `v1=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex")}`;
  assert.equal(requests[0]?.body, rawBody);
  assert.equal(requests[0]?.headers.get("content-type"), "application/json");
  assert.equal(requests[0]?.headers.get("x-wildworks-voice-timestamp"), timestamp);
  assert.equal(requests[0]?.headers.get("x-wildworks-voice-signature"), expected);
  assert.equal(JSON.stringify(log.entries).includes(privateText), false);
  assert.equal(JSON.stringify(log.entries).includes("+15555550123"), false);
  assert.equal(JSON.stringify(log.entries).includes(sampleEvent.callSid), false);
});

test("does not retry a non-retryable authentication rejection", async () => {
  let calls = 0;
  const publisher = new HmacRuntimeEventPublisher({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-events",
    secret: "s".repeat(32),
    timeoutMs: 100,
    maxAttempts: 4,
    retryBaseMs: 10,
    logger: new MockLogger(),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 401 });
    }) as typeof fetch,
    sleep: async () => undefined,
  });
  assert.equal(await publisher.publish(sampleEvent), false);
  assert.equal(calls, 1);
});

test("checks receiver readiness with a signed, empty, non-mutating HEAD", async () => {
  const secret = "s".repeat(32);
  const nowMs = Date.parse("2026-08-01T16:00:00.000Z");
  let capturedInit: RequestInit | undefined;
  const publisher = new HmacRuntimeEventPublisher({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-events",
    secret,
    timeoutMs: 100,
    maxAttempts: 3,
    retryBaseMs: 10,
    logger: new MockLogger(),
    nowMs: () => nowMs,
    fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(null, { status: 204 });
    }) as typeof fetch,
  });

  await publisher.healthCheck();
  const timestamp = String(Math.floor(nowMs / 1_000));
  const headers = new Headers(capturedInit?.headers);
  assert.equal(capturedInit?.method, "HEAD");
  assert.equal(capturedInit?.body, undefined);
  assert.equal(headers.get("x-wildworks-voice-timestamp"), timestamp);
  assert.equal(
    headers.get("x-wildworks-voice-signature"),
    `v1=${createHmac("sha256", secret)
      .update(`${timestamp}.`, "utf8")
      .digest("hex")}`,
  );
});

test("receiver readiness fails closed on any non-204 response", async () => {
  const publisher = new HmacRuntimeEventPublisher({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-events",
    secret: "s".repeat(32),
    timeoutMs: 100,
    maxAttempts: 3,
    retryBaseMs: 10,
    logger: new MockLogger(),
    fetchImpl: (async () => new Response(null, { status: 503 })) as typeof fetch,
  });
  await assert.rejects(() => publisher.healthCheck(), /health status 503/);
});

test("aborts a hung request and stops after the configured attempt cap", async () => {
  let calls = 0;
  const publisher = new HmacRuntimeEventPublisher({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-events",
    secret: "s".repeat(32),
    timeoutMs: 5,
    maxAttempts: 2,
    retryBaseMs: 1,
    logger: new MockLogger(),
    fetchImpl: ((_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("timed out", "AbortError"));
        });
      });
    }) as typeof fetch,
    sleep: async () => undefined,
  });
  assert.equal(await publisher.publish(sampleEvent), false);
  assert.equal(calls, 2);
});

test("deterministic ids are stable without exposing their source content", () => {
  const first = deterministicVoiceId("message", "call", "session", privateText);
  const second = deterministicVoiceId("message", "call", "session", privateText);
  const changed = deterministicVoiceId("message", "call", "session", `${privateText}!`);
  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.equal(first.includes(privateText), false);
  assert.match(first, /^ww_voice_v1_message_[a-f0-9]{64}$/);
});
