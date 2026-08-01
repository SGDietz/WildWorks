import assert from "node:assert/strict";
import test from "node:test";
import { SerializedInboundFrames } from "../src/inbound-frames.ts";

function frame(type: string, value = ""): string {
  return JSON.stringify({ type, value });
}

test("a prompt cannot outrun setup while its shared-budget reservation is pending", async () => {
  const observed: string[] = [];
  let releaseSetup: (() => void) | undefined;
  const setupPending = new Promise<void>((resolve) => {
    releaseSetup = resolve;
  });
  const queue = new SerializedInboundFrames(async (raw) => {
    const parsed = JSON.parse(raw) as { type: string };
    observed.push(parsed.type);
    if (parsed.type === "setup") await setupPending;
  });

  const setup = queue.enqueue(frame("setup"));
  const prompt = queue.enqueue(frame("prompt"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(observed, ["setup"]);
  releaseSetup?.();
  await Promise.all([setup, prompt]);
  assert.deepEqual(observed, ["setup", "prompt"]);
});

test("prompts are processed strictly in arrival order", async () => {
  const observed: string[] = [];
  let releaseFirstPrompt: (() => void) | undefined;
  const firstPromptPending = new Promise<void>((resolve) => {
    releaseFirstPrompt = resolve;
  });
  const queue = new SerializedInboundFrames(async (raw) => {
    const parsed = JSON.parse(raw) as { type: string; value: string };
    observed.push(`${parsed.type}:${parsed.value}`);
    if (parsed.value === "first") await firstPromptPending;
  });

  await queue.enqueue(frame("setup"));
  const first = queue.enqueue(frame("prompt", "first"));
  const second = queue.enqueue(frame("prompt", "second"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(observed, ["setup:", "prompt:first"]);
  releaseFirstPrompt?.();
  await Promise.all([first, second]);
  assert.deepEqual(observed, ["setup:", "prompt:first", "prompt:second"]);
});

test("closing the transport prevents queued frames from running", async () => {
  const observed: string[] = [];
  let releaseSetup: (() => void) | undefined;
  const setupPending = new Promise<void>((resolve) => {
    releaseSetup = resolve;
  });
  const queue = new SerializedInboundFrames(async (raw) => {
    const parsed = JSON.parse(raw) as { type: string };
    observed.push(parsed.type);
    if (parsed.type === "setup") await setupPending;
  });

  const setup = queue.enqueue(frame("setup"));
  const prompt = queue.enqueue(frame("prompt"));
  queue.close();
  releaseSetup?.();
  await Promise.all([setup, prompt]);
  assert.deepEqual(observed, ["setup"]);
});

test("a handler error closes the queue before later work can run", async () => {
  const observed: string[] = [];
  const queue = new SerializedInboundFrames(async (raw) => {
    const parsed = JSON.parse(raw) as { type: string };
    observed.push(parsed.type);
    if (parsed.type === "setup") throw new Error("unexpected setup failure");
  });

  const setup = queue.enqueue(frame("setup"));
  const prompt = queue.enqueue(frame("prompt"));
  await assert.rejects(() => setup, /unexpected setup failure/);
  await prompt;
  assert.deepEqual(observed, ["setup"]);
});
