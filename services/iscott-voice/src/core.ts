import type { VoiceConfig } from "./config.ts";
import type { UsageBudget } from "./limits.ts";
import { DEFAULT_SYSTEM_MESSAGE } from "./llm.ts";
import { parseInboundFrame, request_human_transfer } from "./protocol.ts";
import {
  deterministicVoiceId,
  VOICE_EVENT_VERSION,
  type RuntimeEventPublisher,
  type VoiceRuntimeEvent,
  type VoiceEventType,
} from "./runtime-events.ts";
import type {
  ChatMessage,
  ConversationRelayOutbound,
  LlmClient,
  OutboundSink,
  SafeLogger,
} from "./types.ts";

export interface SessionDependencies {
  config: VoiceConfig;
  sink: OutboundSink;
  budget: UsageBudget;
  logger: SafeLogger;
  systemMessage?: ChatMessage;
  llm?: LlmClient;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  eventPublisher?: RuntimeEventPublisher;
  now?: () => Date;
}

interface VoiceEventContext {
  sessionId: string;
  callSid: string;
  from?: string;
  to?: string;
}

export class ConversationSession {
  private readonly deps: SessionDependencies;
  private setupComplete = false;
  private ended = false;
  private promptFragments = "";
  private prompts = 0;
  private messages = 0;
  private inputChars = 0;
  private outputChars = 0;
  private generation = 0;
  private activeAbort: AbortController | undefined;
  private history: ChatMessage[];
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly clearTimer: typeof clearTimeout;
  private readonly now: () => Date;
  private eventContext: VoiceEventContext | undefined;
  private userMessageSequence = 0;
  private assistantMessageSequence = 0;
  private terminalEventsStarted = false;

  constructor(deps: SessionDependencies) {
    this.deps = deps;
    this.history = [deps.systemMessage ?? DEFAULT_SYSTEM_MESSAGE];
    const setTimer = deps.setTimer ?? setTimeout;
    this.clearTimer = deps.clearTimer ?? clearTimeout;
    this.now = deps.now ?? (() => new Date());
    this.timer = setTimer(
      () => this.end("call_duration_limit", this.setupComplete ? "voicemail" : "none"),
      deps.config.callMaxSeconds * 1_000,
    );
  }

  async handleRaw(raw: string): Promise<void> {
    if (this.ended) return;
    const message = parseInboundFrame(raw);
    if (!message) {
      this.deps.logger.warn("protocol_rejected");
      this.end("protocol_error");
      return;
    }
    this.messages += 1;
    if (this.messages > this.deps.config.callMaxMessages) {
      this.end("message_limit", this.setupComplete ? "voicemail" : "none");
      return;
    }

    if (!this.setupComplete && message.type !== "setup") {
      this.deps.logger.warn("setup_required");
      this.end("setup_required");
      return;
    }

    switch (message.type) {
      case "setup":
        if (this.setupComplete || message.accountSid !== this.deps.config.twilioAccountSid) {
          this.deps.logger.warn("setup_rejected");
          this.end("authentication_failed");
          return;
        }
        if (!(await this.reserveCall())) {
          if (!this.ended) {
            this.deps.logger.warn("daily_call_limit");
            this.end("daily_limit", "voicemail");
          }
          return;
        }
        this.setupComplete = true;
        if (this.deps.eventPublisher) {
          if (
            typeof message.callSid !== "string" ||
            !/^CA[a-fA-F0-9]{32}$/.test(message.callSid) ||
            message.sessionId.trim().length === 0 ||
            message.sessionId.length > 256
          ) {
            this.deps.logger.warn("event_identity_rejected");
            this.end("event_identity_invalid", "voicemail");
            return;
          }
          this.eventContext = {
            sessionId: message.sessionId,
            callSid: message.callSid,
            ...(typeof message.from === "string" && message.from
              ? { from: message.from }
              : {}),
            ...(typeof message.to === "string" && message.to ? { to: message.to } : {}),
          };
          const sessionStart = this.createEvent("session_start", "session_start", {
            ...(typeof message.from === "string" && message.from
              ? { callerPhone: message.from }
              : {}),
            ...(typeof message.to === "string" && message.to
              ? { metadata: { to: message.to } }
              : {}),
          });
          if (!(await this.publishRequired(sessionStart))) return;
        }
        this.deps.logger.info("session_ready");
        return;
      case "prompt":
        await this.handlePrompt(message.voicePrompt, message.last !== false);
        return;
      case "interrupt":
        this.generation += 1;
        this.activeAbort?.abort();
        this.activeAbort = undefined;
        this.deps.logger.info("response_interrupted");
        return;
      case "error":
        this.deps.logger.warn("twilio_relay_error");
        this.end("relay_error", "voicemail");
    }
  }

  close(): void {
    if (this.ended) return;
    this.ended = true;
    this.generation += 1;
    this.activeAbort?.abort();
    this.clearTimer(this.timer);
    this.publishTerminalEvents("transport_closed", "none");
    this.history = [];
    this.promptFragments = "";
    this.deps.logger.info("session_closed");
  }

  private async handlePrompt(fragment: string, last: boolean): Promise<void> {
    this.inputChars += fragment.length;
    if (this.inputChars > this.deps.config.callMaxInputChars) {
      this.end("input_limit", "voicemail");
      return;
    }
    this.promptFragments += fragment;
    if (!last) return;

    const prompt = this.promptFragments.trim();
    this.promptFragments = "";
    if (!prompt) return;
    const generation = ++this.generation;
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.prompts += 1;
    if (
      this.prompts > this.deps.config.callMaxPrompts ||
      !(await this.reservePrompt())
    ) {
      if (!this.ended) this.end("prompt_limit", "voicemail");
      return;
    }
    if (this.ended || generation !== this.generation) return;

    if (this.deps.eventPublisher) {
      const userSequence = ++this.userMessageSequence;
      const messageId = this.createMessageId("user", userSequence, prompt);
      const userEvent = this.createEvent("user_message", messageId, {
        messageId,
        text: prompt,
      });
      if (!(await this.publishRequired(userEvent))) return;
      if (this.ended || generation !== this.generation) return;
    }

    if (request_human_transfer(prompt)) {
      this.deps.logger.info("human_transfer_requested");
      this.end("caller_requested_human", "voicemail");
      return;
    }

    if (!this.deps.config.aiEnabled || !this.deps.llm) {
      this.deps.logger.warn("ai_unavailable");
      this.end("ai_unavailable", "voicemail");
      return;
    }

    const abort = new AbortController();
    this.activeAbort = abort;
    this.history.push({ role: "user", content: prompt });
    this.trimHistory();

    let pending = "";
    let complete = "";
    try {
      for await (const token of this.deps.llm.stream({
        messages: [...this.history],
        signal: abort.signal,
        maxTokens: this.deps.config.llmMaxTokens,
      })) {
        if (abort.signal.aborted || generation !== this.generation || this.ended) return;
        const room = this.deps.config.callMaxOutputChars - this.outputChars - pending.length;
        if (room <= 0) break;
        const accepted = token.slice(0, room);
        pending += accepted;
        complete += accepted;
        while (pending.length >= this.deps.config.responseChunkChars) {
          const chunk = pending.slice(0, this.deps.config.responseChunkChars);
          pending = pending.slice(this.deps.config.responseChunkChars);
          if (!(await this.sendText(chunk, false))) return;
        }
      }
      if (generation !== this.generation || this.ended) return;
      if (!(await this.sendText(pending || " ", true))) return;
      if (complete) {
        if (this.deps.eventPublisher) {
          const assistantSequence = ++this.assistantMessageSequence;
          const messageId = this.createMessageId("assistant", assistantSequence, complete);
          const assistantEvent = this.createEvent("assistant_message", messageId, {
            messageId,
            text: complete,
          });
          if (!(await this.publishRequired(assistantEvent))) return;
        }
        this.history.push({ role: "assistant", content: complete });
        this.trimHistory();
      }
    } catch (error) {
      if (abort.signal.aborted) return;
      this.deps.logger.error("llm_failed", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      this.end("llm_failed", "voicemail");
    } finally {
      if (this.activeAbort === abort) this.activeAbort = undefined;
    }
  }

  handoffToBusinessVoicemail(reason = "service_shutdown"): void {
    this.end(reason, "voicemail");
  }

  private async sendText(token: string, last: boolean): Promise<boolean> {
    if (this.ended || token.length === 0) return false;
    const callRoom = Math.max(0, this.deps.config.callMaxOutputChars - this.outputChars);
    const requested = Math.min(token.length, callRoom);
    let granted: number;
    try {
      granted = await this.deps.budget.reserveOutput(requested);
    } catch {
      this.deps.logger.error("budget_unavailable");
      this.end("budget_unavailable", "voicemail");
      return false;
    }
    if (granted <= 0) {
      this.end("output_limit", "voicemail");
      return false;
    }
    const safeToken = token.slice(0, granted);
    this.outputChars += safeToken.length;
    const message: ConversationRelayOutbound = {
      type: "text",
      token: safeToken,
      last: last || granted < token.length,
      interruptible: true,
      preemptible: true,
    };
    this.deps.sink.send(message);
    return granted === token.length;
  }

  private async reserveCall(): Promise<boolean> {
    try {
      return await this.deps.budget.reserveCall();
    } catch {
      this.deps.logger.error("budget_unavailable");
      this.end("budget_unavailable", "voicemail");
      return false;
    }
  }

  private async reservePrompt(): Promise<boolean> {
    try {
      return await this.deps.budget.reservePrompt();
    } catch {
      this.deps.logger.error("budget_unavailable");
      this.end("budget_unavailable", "voicemail");
      return false;
    }
  }

  private trimHistory(): void {
    const max = this.deps.config.callMaxContextMessages;
    if (this.history.length <= max) return;
    this.history = [this.history[0] ?? DEFAULT_SYSTEM_MESSAGE, ...this.history.slice(-(max - 1))];
  }

  private createMessageId(role: "user" | "assistant", sequence: number, text: string): string {
    const context = this.eventContext;
    if (!context) throw new Error("Voice event context is unavailable");
    return deterministicVoiceId(
      "message",
      context.callSid,
      context.sessionId,
      role,
      String(sequence),
      text,
    );
  }

  private createEvent(
    eventType: VoiceEventType,
    discriminator: string,
    fields: Pick<
      VoiceRuntimeEvent,
      "callerPhone" | "messageId" | "metadata" | "summary" | "text"
    > = {},
  ): VoiceRuntimeEvent {
    const context = this.eventContext;
    if (!context) throw new Error("Voice event context is unavailable");
    return {
      version: VOICE_EVENT_VERSION,
      eventId: deterministicVoiceId(
        "event",
        context.callSid,
        context.sessionId,
        eventType,
        discriminator,
      ),
      eventType,
      occurredAt: this.now().toISOString(),
      callSid: context.callSid,
      sessionId: context.sessionId,
      ...fields,
    };
  }

  private async publishRequired(event: VoiceRuntimeEvent): Promise<boolean> {
    const publisher = this.deps.eventPublisher;
    if (!publisher) return true;
    let delivered = false;
    try {
      delivered = await publisher.publish(event);
    } catch {
      delivered = false;
    }
    if (delivered) return true;
    this.deps.logger.error("required_voice_event_unavailable", {
      eventType: event.eventType,
    });
    this.end("event_persistence_unavailable", "voicemail");
    return false;
  }

  private publishTerminalEvents(reason: string, target: string): void {
    const publisher = this.deps.eventPublisher;
    if (!publisher || !this.eventContext || this.terminalEventsStarted) return;
    this.terminalEventsStarted = true;

    const events: VoiceRuntimeEvent[] = [];
    if (target === "voicemail") {
      events.push(
        this.createEvent("handoff", `handoff:${reason}:${target}`, {
          metadata: { reason, target },
        }),
      );
    }
    events.push(
      this.createEvent("session_end", `session_end:${reason}:${target}`, {
        metadata: { reason, target },
      }),
    );

    void (async () => {
      for (const event of events) {
        try {
          const delivered = await publisher.publish(event);
          if (!delivered) {
            this.deps.logger.warn("terminal_voice_event_unavailable", {
              eventType: event.eventType,
            });
          }
        } catch {
          this.deps.logger.warn("terminal_voice_event_unavailable", {
            eventType: event.eventType,
          });
        }
      }
    })();
  }

  private end(reason: string, target = "none"): void {
    if (this.ended) return;
    this.ended = true;
    this.generation += 1;
    this.activeAbort?.abort();
    this.clearTimer(this.timer);
    this.publishTerminalEvents(reason, target);
    this.deps.sink.send({
      type: "end",
      handoffData: JSON.stringify({ reason, target }),
    });
    this.history = [];
    this.promptFragments = "";
  }
}
