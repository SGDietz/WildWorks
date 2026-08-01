import assert from "node:assert/strict";
import test from "node:test";
import { GracefulCallDrain, type DrainingCall } from "../src/shutdown.ts";

class MockCall implements DrainingCall {
  handoffs: string[] = [];
  closes = 0;
  handoffToBusinessVoicemail(reason: "service_shutdown"): void {
    this.handoffs.push(reason);
  }
  closeTransport(): void {
    this.closes += 1;
  }
}

test("shutdown rejects new calls while allowing active calls to finish naturally", async () => {
  const drain = new GracefulCallDrain();
  const active = new MockCall();
  assert.equal(drain.register(active), true);
  drain.stopAccepting();
  assert.equal(drain.register(new MockCall()), false);

  const pending = drain.drain({ maxDrainMs: 50, handoffGraceMs: 10 });
  drain.unregister(active);
  await pending;
  assert.deepEqual(active.handoffs, []);
  assert.equal(active.closes, 0);
});

test("shutdown sends every remaining call to business voicemail before transport close", async () => {
  const drain = new GracefulCallDrain();
  const active = new MockCall();
  drain.register(active);
  await drain.drain({ maxDrainMs: 5, handoffGraceMs: 5 });
  assert.deepEqual(active.handoffs, ["service_shutdown"]);
  assert.equal(active.closes, 1);
  assert.equal(JSON.stringify(active).includes("phone"), false);
  assert.equal(JSON.stringify(active).includes("none"), false);
});
