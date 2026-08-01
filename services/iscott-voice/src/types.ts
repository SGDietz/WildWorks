export type SafeLogFields = Record<string, boolean | number | string | undefined>;

export interface SafeLogger {
  info(event: string, fields?: SafeLogFields): void;
  warn(event: string, fields?: SafeLogFields): void;
  error(event: string, fields?: SafeLogFields): void;
}

export interface SetupMessage {
  type: "setup";
  sessionId: string;
  accountSid: string;
  callSid?: string;
  parentCallSid?: string;
  from?: string;
  to?: string;
  direction?: string;
  customParameters?: Record<string, string>;
}

export interface PromptMessage {
  type: "prompt";
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}

export interface InterruptMessage {
  type: "interrupt";
  utteranceUntilInterrupt?: string;
  durationUntilInterruptMs?: number;
}

export interface ErrorMessage {
  type: "error";
  description?: string;
}

export type ConversationRelayInbound =
  | SetupMessage
  | PromptMessage
  | InterruptMessage
  | ErrorMessage;

export interface TextMessage {
  type: "text";
  token: string;
  last: boolean;
  interruptible: true;
  preemptible: true;
}

export interface EndMessage {
  type: "end";
  handoffData: string;
}

export type ConversationRelayOutbound = TextMessage | EndMessage;

export interface OutboundSink {
  send(message: ConversationRelayOutbound): void;
  close(code?: number, reason?: string): void;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmStreamRequest {
  messages: ChatMessage[];
  signal: AbortSignal;
  maxTokens: number;
}

export interface LlmClient {
  stream(request: LlmStreamRequest): AsyncIterable<string>;
}
