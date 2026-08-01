import assert from "node:assert/strict";
import test from "node:test";
import { CallFlowController, CONSENT_MENU_PROMPT } from "../src/call-flow.ts";
import type { EmailNotificationEvent, EmailNotificationPublisher } from "../src/notifications.ts";

const fixedNow = () => new Date("2026-08-01T12:00:00.000Z");

test("call starts with the pre-AI disclosure and DTMF consent menu", () => {
  const flow = new CallFlowController({ aiEnabled: true, now: fixedNow });
  assert.deepEqual(flow.dispatch({ type: "call_started" }), [
    { type: "play_consent_menu", prompt: CONSENT_MENU_PROMPT },
  ]);
  assert.match(CONSENT_MENU_PROMPT, /AI assistant, not the real Scott/i);
  assert.match(CONSENT_MENU_PROMPT, /Press 1 to consent/i);
  assert.match(CONSENT_MENU_PROMPT, /Press 2 to leave a recorded WildWorks voicemail/i);
});

test("Press 1 enters the AI path only when AI is enabled", () => {
  const enabled = new CallFlowController({ aiEnabled: true, now: fixedNow });
  enabled.dispatch({ type: "call_started" });
  assert.deepEqual(enabled.dispatch({ type: "dtmf", digit: "1" }), [{ type: "start_ai" }]);
  assert.equal(enabled.currentState(), "ai_active");

  const disabled = new CallFlowController({ aiEnabled: false, now: fixedNow });
  disabled.dispatch({ type: "call_started" });
  const actions = disabled.dispatch({ type: "dtmf", digit: "1" });
  assert.equal(actions[0]?.type, "start_voicemail");
  assert.equal(actions[1]?.type, "request_email_notification");
  assert.equal(disabled.currentState(), "voicemail_active");
});

test("Press 2 deterministically enters WildWorks business voicemail", () => {
  const flow = new CallFlowController({ aiEnabled: true, now: fixedNow });
  flow.dispatch({ type: "call_started" });
  assert.deepEqual(flow.dispatch({ type: "dtmf", digit: "2" }), [
    { type: "start_voicemail", reason: "caller_choice" },
  ]);
  assert.equal(flow.currentState(), "voicemail_active");
});

test("AI failure routes to voicemail and emits a provider-neutral email event", () => {
  const flow = new CallFlowController({ aiEnabled: true, now: fixedNow });
  flow.dispatch({ type: "call_started" });
  flow.dispatch({ type: "dtmf", digit: "1" });
  assert.deepEqual(flow.dispatch({ type: "ai_failed", reason: "ai_error" }), [
    { type: "start_voicemail", reason: "ai_error" },
    {
      type: "request_email_notification",
      event: {
        kind: "ai_failure_routed_to_voicemail",
        occurredAt: "2026-08-01T12:00:00.000Z",
        reason: "ai_error",
      },
    },
  ]);
});

test("recorded voicemail requests email notification without caller PII", () => {
  const flow = new CallFlowController({ aiEnabled: true, now: fixedNow });
  flow.dispatch({ type: "call_started" });
  flow.dispatch({ type: "dtmf", digit: "2" });
  const actions = flow.dispatch({
    type: "voicemail_recorded",
    voicemailReference: "RE-opaque-reference",
  });
  assert.deepEqual(actions, [
    {
      type: "request_email_notification",
      event: {
        kind: "voicemail_ready",
        occurredAt: "2026-08-01T12:00:00.000Z",
        reason: "voicemail_recorded",
        voicemailReference: "RE-opaque-reference",
      },
    },
    { type: "end_call" },
  ]);
  assert.equal(JSON.stringify(actions).includes("phone"), false);
  assert.equal(flow.currentState(), "complete");
});

test("invalid menu input retries once, then fails safely to voicemail", () => {
  const flow = new CallFlowController({ aiEnabled: true, maxMenuAttempts: 2, now: fixedNow });
  flow.dispatch({ type: "call_started" });
  assert.equal(flow.dispatch({ type: "dtmf", digit: "9" })[0]?.type, "play_consent_menu");
  assert.deepEqual(flow.dispatch({ type: "dtmf", digit: "0" }), [
    { type: "start_voicemail", reason: "invalid_menu_input" },
  ]);
});

test("the controller exposes no automatic dial or direct-cell action", () => {
  const flow = new CallFlowController({ aiEnabled: true, now: fixedNow });
  const actions = [
    ...flow.dispatch({ type: "call_started" }),
    ...flow.dispatch({ type: "dtmf", digit: "1" }),
    ...flow.dispatch({ type: "ai_failed", reason: "caller_requested_person" }),
  ];
  const actionTypes = actions.map((action) => action.type);
  assert.equal(actionTypes.some((type) => /dial|forward|cell|transfer/.test(type)), false);
});

test("email notification remains an interface with a mock publisher, not a provider call", async () => {
  const published: EmailNotificationEvent[] = [];
  const publisher: EmailNotificationPublisher = {
    async publish(event) {
      published.push(event);
    },
  };
  const event: EmailNotificationEvent = {
    kind: "voicemail_ready",
    occurredAt: "2026-08-01T12:00:00.000Z",
    reason: "voicemail_recorded",
    voicemailReference: "RE-opaque-reference",
  };
  await publisher.publish(event);
  assert.deepEqual(published, [event]);
});
