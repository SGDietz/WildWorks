import assert from "node:assert/strict";
import test from "node:test";
import type { VoiceConfig } from "../src/config.ts";
import { ConversationSession } from "../src/core.ts";
import { DailyBudget, type UsageBudget } from "../src/limits.ts";
import type {
  RuntimeEventPublisher,
  VoiceRuntimeEvent,
} from "../src/runtime-events.ts";
import type {
  ConversationRelayOutbound,
  LlmClient,
  LlmStreamRequest,
  OutboundSink,
  SafeLogFields,
  SafeLogger,
} from "../src/types.ts";

const ACCOUNT_SID = `AC${"a".repeat(32)}`;
const baseConfig: VoiceConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 8080,
  publicWssUrl: "wss://voice.example.test/twilio/conversationrelay",
  twilioAccountSid: ACCOUNT_SID,
  twilioAuthToken: "test-token",
  aiEnabled: false,
  llmEndpointUrl: "",
  llmApiKey: "",
  llmModel: "",
  llmTimeoutMs: 1_000,
  llmMaxTokens: 64,
  callMaxSeconds: 120,
  callMaxMessages: 16,
  callMaxPrompts: 4,
  callMaxInputChars: 1_000,
  callMaxOutputChars: 500,
  callMaxContextMessages: 6,
  responseChunkChars: 20,
  dailyMaxCalls: 10,
  dailyMaxPrompts: 20,
  dailyMaxOutputChars: 2_000,
  budgetBackend: "memory",
  budgetTimeoutMs: 1_000,
  supabaseUrl: "",
  supabaseServiceRoleKey: "",
  supabaseBudgetRpc: "reserve_iscott_voice_daily_usage",
  voiceEventUrl: "",
  voiceEventSecret: "",
  voiceEventTimeoutMs: 1_500,
  voiceEventMaxAttempts: 3,
  voiceEventRetryBaseMs: 100,
  voiceMaintenanceUrl: "",
  voiceCronSecret: "",
  voiceMaintenanceIntervalMs: 300_000,
  voiceMaintenanceTimeoutMs: 5_000,
  shutdownHandoffGraceMs: 100,
};

class MockSocket implements OutboundSink {
  messages: ConversationRelayOutbound[] = [];
  closed: Array<{ code?: number; reason?: string }> = [];
  send(message: ConversationRelayOutbound): void {
    this.messages.push(message);
  }
  close(code?: number, reason?: string): void {
    this.closed.push({ ...(code === undefined ? {} : { code }), ...(reason ? { reason } : {}) });
  }
}

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

class MockEventPublisher implements RuntimeEventPublisher {
  events: VoiceRuntimeEvent[] = [];
  private readonly outcomes: boolean[];

  constructor(outcomes: boolean[] = []) {
    this.outcomes = [...outcomes];
  }

  async publish(event: VoiceRuntimeEvent): Promise<boolean> {
    this.events.push(event);
    return this.outcomes.shift() ?? true;
  }
}

function setupFrame(accountSid = ACCOUNT_SID): string {
  return JSON.stringify({
    type: "setup",
    sessionId: "session-test",
    accountSid,
    callSid: "call-test",
    from: "+15555550123",
    to: "+18776002474",
  });
}

function promptFrame(text: string): string {
  return JSON.stringify({ type: "prompt", voicePrompt: text, last: true });
}

function createSession(
  overrides: Partial<{
    config: VoiceConfig;
    llm: LlmClient;
    budget: UsageBudget;
    eventPublisher: RuntimeEventPublisher;
    now: () => Date;
  }> = {},
) {
  const socket = new MockSocket();
  const log = new MockLogger();
  const config = overrides.config ?? baseConfig;
  const budget =
    overrides.budget ??
    new DailyBudget({
      maxCalls: config.dailyMaxCalls,
      maxPrompts: config.dailyMaxPrompts,
      maxOutputChars: config.dailyMaxOutputChars,
    });
  const session = new ConversationSession({
    config,
    sink: socket,
    budget,
    logger: log,
    ...(overrides.llm ? { llm: overrides.llm } : {}),
    ...(overrides.eventPublisher ? { eventPublisher: overrides.eventPublisher } : {}),
    ...(overrides.now ? { now: overrides.now } : {}),
    setTimer: (() => ({}) as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout,
    clearTimer: (() => undefined) as typeof clearTimeout,
  });
  return { session, socket, log };
}

function runtimeSetupFrame(): string {
  return JSON.stringify({
    type: "setup",
    sessionId: "VX-session-test",
    accountSid: ACCOUNT_SID,
    callSid: `CA${"c".repeat(32)}`,
    from: "+15555550123",
    to: "+18776002474",
  });
}

test("requires setup and rejects a mismatched Twilio Account SID", async () => {
  const wrong = createSession();
  await wrong.session.handleRaw(setupFrame(`AC${"b".repeat(32)}`));
  assert.deepEqual(wrong.socket.messages, [
    {
      type: "end",
      handoffData: JSON.stringify({ reason: "authentication_failed", target: "none" }),
    },
  ]);

  const missing = createSession();
  await missing.session.handleRaw(promptFrame("hello"));
  assert.equal(missing.socket.messages[0]?.type, "end");
});

test("AI stays disabled by default and no prompt or phone number reaches logs", async () => {
  const { session, socket, log } = createSession();
  await session.handleRaw(setupFrame());
  const privatePrompt = "My phone is +15555550123 and my gate code is 9999";
  await session.handleRaw(promptFrame(privatePrompt));
  assert.deepEqual(socket.messages[0], {
    type: "end",
    handoffData: JSON.stringify({ reason: "ai_unavailable", target: "voicemail" }),
  });
  const serializedLogs = JSON.stringify(log.entries);
  assert.equal(serializedLogs.includes(privatePrompt), false);
  assert.equal(serializedLogs.includes("+15555550123"), false);
  session.close();
});

test("explicit caller language routes to business voicemail, never a direct cell", async () => {
  const config = { ...baseConfig, aiEnabled: true };
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      yield "unused";
    },
  };
  const { session, socket } = createSession({ config, llm });
  await session.handleRaw(setupFrame());
  await session.handleRaw(promptFrame("Please let me talk to Scott."));
  assert.deepEqual(socket.messages.at(-1), {
    type: "end",
    handoffData: JSON.stringify({ reason: "caller_requested_human", target: "voicemail" }),
  });
  assert.equal(JSON.stringify(socket.messages).includes("+1443"), false);
});

test("model text cannot arbitrarily request a human transfer and output is chunked and bounded", async () => {
  const llm: LlmClient = {
    async *stream(_request: LlmStreamRequest): AsyncIterable<string> {
      yield "request_human_transfer ";
      yield "This remains ordinary model text that is deliberately long.";
    },
  };
  const config = {
    ...baseConfig,
    aiEnabled: true,
    llmEndpointUrl: "https://llm.example.test/v1/chat/completions",
    llmApiKey: "test-key",
    llmModel: "test-model",
    callMaxOutputChars: 55,
    responseChunkChars: 20,
  };
  const { session, socket } = createSession({ config, llm });
  await session.handleRaw(setupFrame());
  await session.handleRaw(promptFrame("Tell me about WildWorks."));
  assert.equal(socket.messages.some((message) => message.type === "end"), false);
  const text = socket.messages.filter((message) => message.type === "text");
  assert.ok(text.length >= 2);
  assert.ok(text.every((message) => message.type !== "text" || message.token.length <= 20));
  assert.ok(
    text.reduce((sum, message) => sum + (message.type === "text" ? message.token.length : 0), 0) <=
      config.callMaxOutputChars,
  );
  session.close();
});

test("interrupt aborts an in-flight provider response", async () => {
  let observedAbort = false;
  let release: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const llm: LlmClient = {
    async *stream(request: LlmStreamRequest): AsyncIterable<string> {
      markStarted?.();
      await Promise.race([
        waiting,
        new Promise<void>((resolve) => {
          request.signal.addEventListener("abort", () => {
            observedAbort = true;
            resolve();
          });
        }),
      ]);
      if (!request.signal.aborted) yield "response";
    },
  };
  const config = { ...baseConfig, aiEnabled: true };
  const { session } = createSession({ config, llm });
  await session.handleRaw(setupFrame());
  const pending = session.handleRaw(promptFrame("A normal question"));
  await started;
  await session.handleRaw(JSON.stringify({ type: "interrupt" }));
  release?.();
  await pending;
  assert.equal(observedAbort, true);
  session.close();
});

test("Twilio relay errors end the session without logging the supplied description", async () => {
  const { session, socket, log } = createSession();
  await session.handleRaw(setupFrame());
  await session.handleRaw(
    JSON.stringify({ type: "error", description: "private caller material +15555550123" }),
  );
  assert.deepEqual(socket.messages.at(-1), {
    type: "end",
    handoffData: JSON.stringify({ reason: "relay_error", target: "voicemail" }),
  });
  assert.equal(JSON.stringify(log.entries).includes("+15555550123"), false);
});

test("a shared daily call cap fails closed before AI work begins", async () => {
  const budget = new DailyBudget({ maxCalls: 1, maxPrompts: 10, maxOutputChars: 1_000 });
  const first = createSession({ budget });
  const second = createSession({ budget });
  await first.session.handleRaw(setupFrame());
  await second.session.handleRaw(setupFrame());
  assert.equal(first.socket.messages.length, 0);
  assert.deepEqual(second.socket.messages, [
    {
      type: "end",
      handoffData: JSON.stringify({ reason: "daily_limit", target: "voicemail" }),
    },
  ]);
  first.session.close();
});

test("LLM provider failure routes to business voicemail without exposing the failure", async () => {
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      throw new Error("provider detail that must not reach the caller");
    },
  };
  const config = { ...baseConfig, aiEnabled: true };
  const { session, socket, log } = createSession({ config, llm });
  await session.handleRaw(setupFrame());
  await session.handleRaw(promptFrame("Tell me about my project"));
  assert.deepEqual(socket.messages.at(-1), {
    type: "end",
    handoffData: JSON.stringify({ reason: "llm_failed", target: "voicemail" }),
  });
  assert.equal(JSON.stringify(log.entries).includes("provider detail"), false);
});

test("an unavailable shared production budget fails closed to business voicemail", async () => {
  const budget: UsageBudget = {
    async reserveCall() {
      throw new Error("database detail must not escape");
    },
    async reservePrompt() {
      throw new Error("unused");
    },
    async reserveOutput() {
      throw new Error("unused");
    },
    async healthCheck() {
      throw new Error("unused");
    },
  };
  const { session, socket, log } = createSession({ budget });
  await session.handleRaw(setupFrame());
  assert.deepEqual(socket.messages, [
    {
      type: "end",
      handoffData: JSON.stringify({ reason: "budget_unavailable", target: "voicemail" }),
    },
  ]);
  assert.equal(log.entries.some((entry) => entry.event === "budget_unavailable"), true);
  assert.equal(JSON.stringify(log.entries).includes("database detail"), false);
});

test("publishes the locked v1 session and completed-message contract", async () => {
  const publisher = new MockEventPublisher();
  const response = "A concise completed iScott response.";
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      yield response;
    },
  };
  const config = { ...baseConfig, aiEnabled: true, responseChunkChars: 100 };
  const { session, log } = createSession({
    config,
    llm,
    eventPublisher: publisher,
    now: () => new Date("2026-08-01T16:00:00.000Z"),
  });
  const prompt = "Tell me what WildWorks can build.";
  await session.handleRaw(runtimeSetupFrame());
  await session.handleRaw(promptFrame(prompt));

  assert.deepEqual(
    publisher.events.map((event) => event.eventType),
    ["session_start", "user_message", "assistant_message"],
  );
  const start = publisher.events[0];
  assert.equal(start?.version, 1);
  assert.equal(start?.sessionId, "VX-session-test");
  assert.equal(start?.callSid, `CA${"c".repeat(32)}`);
  assert.equal(start?.callerPhone, "+15555550123");
  assert.deepEqual(start?.metadata, { to: "+18776002474" });
  assert.equal(publisher.events[1]?.text, prompt);
  assert.equal(publisher.events[2]?.text, response);
  assert.match(publisher.events[1]?.eventId ?? "", /^ww_voice_v1_event_[a-f0-9]{64}$/);
  assert.match(publisher.events[1]?.messageId ?? "", /^ww_voice_v1_message_[a-f0-9]{64}$/);
  assert.equal(publisher.events[1]?.occurredAt, "2026-08-01T16:00:00.000Z");
  assert.equal(JSON.stringify(log.entries).includes(prompt), false);
  assert.equal(JSON.stringify(log.entries).includes("+15555550123"), false);

  session.close();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(publisher.events.at(-1)?.eventType, "session_end");
  assert.deepEqual(publisher.events.at(-1)?.metadata, {
    reason: "transport_closed",
    target: "none",
  });
});

test("a required user event failure stops AI spend and hands off only to business voicemail", async () => {
  const publisher = new MockEventPublisher([true, false]);
  let llmCalls = 0;
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      llmCalls += 1;
      yield "must not run";
    },
  };
  const config = { ...baseConfig, aiEnabled: true };
  const { session, socket } = createSession({ config, llm, eventPublisher: publisher });
  await session.handleRaw(runtimeSetupFrame());
  await session.handleRaw(promptFrame("A private new-project inquiry"));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(llmCalls, 0);
  assert.deepEqual(socket.messages.at(-1), {
    type: "end",
    handoffData: JSON.stringify({
      reason: "event_persistence_unavailable",
      target: "voicemail",
    }),
  });
  assert.deepEqual(
    publisher.events.map((event) => event.eventType),
    ["session_start", "user_message", "handoff", "session_end"],
  );
  assert.equal(JSON.stringify(socket.messages).includes("+1443"), false);
});

test("a human request publishes its final prompt, handoff reason, and session end", async () => {
  const publisher = new MockEventPublisher();
  const config = { ...baseConfig, aiEnabled: true };
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      yield "unused";
    },
  };
  const { session } = createSession({ config, llm, eventPublisher: publisher });
  await session.handleRaw(runtimeSetupFrame());
  await session.handleRaw(promptFrame("Please let me talk to Scott."));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(
    publisher.events.map((event) => event.eventType),
    ["session_start", "user_message", "handoff", "session_end"],
  );
  assert.deepEqual(publisher.events[2]?.metadata, {
    reason: "caller_requested_human",
    target: "voicemail",
  });
  assert.deepEqual(publisher.events[3]?.metadata, {
    reason: "caller_requested_human",
    target: "voicemail",
  });
});

test("a completed assistant event failure ends further AI and hands off after the spoken reply", async () => {
  const publisher = new MockEventPublisher([true, true, false]);
  const reply = "Here is the completed answer.";
  const llm: LlmClient = {
    async *stream(): AsyncIterable<string> {
      yield reply;
    },
  };
  const config = { ...baseConfig, aiEnabled: true, responseChunkChars: 100 };
  const { session, socket } = createSession({ config, llm, eventPublisher: publisher });
  await session.handleRaw(runtimeSetupFrame());
  await session.handleRaw(promptFrame("Tell me about WildWorks."));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(
    socket.messages.some((message) => message.type === "text" && message.token === reply),
    true,
  );
  assert.deepEqual(socket.messages.at(-1), {
    type: "end",
    handoffData: JSON.stringify({
      reason: "event_persistence_unavailable",
      target: "voicemail",
    }),
  });
  assert.deepEqual(
    publisher.events.map((event) => event.eventType),
    ["session_start", "user_message", "assistant_message", "handoff", "session_end"],
  );
});
