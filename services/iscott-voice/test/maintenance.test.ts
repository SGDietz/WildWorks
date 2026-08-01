import assert from "node:assert/strict";
import test from "node:test";
import {
  runVoiceMaintenanceOnce,
  VoiceMaintenanceScheduler,
} from "../src/maintenance.ts";
import type { SafeLogger } from "../src/types.ts";

test("maintenance uses only an authenticated POST and accepts a 2xx response", async () => {
  let captured: RequestInit | undefined;
  const secret = "c".repeat(32);
  const ok = await runVoiceMaintenanceOnce({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-email-drain",
    secret,
    timeoutMs: 100,
    fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
      captured = init;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(ok, true);
  assert.equal(captured?.method, "POST");
  assert.equal(captured?.body, undefined);
  assert.equal(new Headers(captured?.headers).get("authorization"), `Bearer ${secret}`);
});

test("maintenance fails closed on rejection without exposing response content", async () => {
  const ok = await runVoiceMaintenanceOnce({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-email-drain",
    secret: "c".repeat(32),
    timeoutMs: 100,
    fetchImpl: (async () => new Response("private", { status: 503 })) as typeof fetch,
  });
  assert.equal(ok, false);
});

test("scheduler cannot overlap a slow maintenance request", async () => {
  let calls = 0;
  let resolveFirst: ((response: Response) => void) | undefined;
  const first = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  const logger: SafeLogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  const scheduler = new VoiceMaintenanceScheduler({
    endpointUrl: "https://www.wildworks.live/api/internal/voice-email-drain",
    secret: "c".repeat(32),
    timeoutMs: 1_000,
    intervalMs: 5,
    initialDelayMs: 0,
    random: () => 0.5,
    logger,
    fetchImpl: (async () => {
      calls += 1;
      return calls === 1 ? first : new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  scheduler.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 1);
  resolveFirst?.(new Response(null, { status: 200 }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(calls >= 2);
  scheduler.stop();
});
