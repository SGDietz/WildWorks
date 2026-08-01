import type { ChatMessage, LlmClient, LlmStreamRequest } from "./types.ts";

export interface OpenAiCompatibleOptions {
  endpointUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

export class OpenAiCompatibleClient implements LlmClient {
  private readonly fetchImpl: typeof fetch;
  private readonly options: OpenAiCompatibleOptions;

  constructor(options: OpenAiCompatibleOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async *stream(request: LlmStreamRequest): AsyncIterable<string> {
    const endpoint = new URL(this.options.endpointUrl);
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        stream: true,
      }),
      signal,
    });

    if (!response.ok || !response.body) throw new Error("LLM request failed");
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const bytes of response.body) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const chunk = JSON.parse(data) as ChatCompletionChunk;
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) yield token;
      }
    }
  }
}

export const DEFAULT_SYSTEM_MESSAGE: ChatMessage = {
  role: "system",
  content:
    "You are iScott, the concise WildWorks phone concierge. Ask one useful question at a time, do not claim to be human, do not give legal, medical, or financial advice, and never promise price or scheduling. Requests for a person go to the approved WildWorks business voicemail path; there is no automatic direct-cell forwarding.",
};
