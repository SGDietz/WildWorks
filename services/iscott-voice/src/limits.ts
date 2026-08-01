export interface DailyLimitConfig {
  maxCalls: number;
  maxPrompts: number;
  maxOutputChars: number;
}

export interface UsageBudget {
  reserveCall(): Promise<boolean>;
  reservePrompt(): Promise<boolean>;
  reserveOutput(requestedChars: number): Promise<number>;
  healthCheck(): Promise<void>;
}

/**
 * Development/test-only counter. Production config rejects this backend because
 * separate Render instances cannot share process memory.
 */
export class DailyBudget implements UsageBudget {
  private readonly config: DailyLimitConfig;
  private readonly now: () => Date;
  private day = "";
  private calls = 0;
  private prompts = 0;
  private outputChars = 0;

  constructor(config: DailyLimitConfig, now: () => Date = () => new Date()) {
    this.config = config;
    this.now = now;
  }

  private refresh(): void {
    const currentDay = this.now().toISOString().slice(0, 10);
    if (currentDay !== this.day) {
      this.day = currentDay;
      this.calls = 0;
      this.prompts = 0;
      this.outputChars = 0;
    }
  }

  async reserveCall(): Promise<boolean> {
    this.refresh();
    if (this.calls >= this.config.maxCalls) return false;
    this.calls += 1;
    return true;
  }

  async reservePrompt(): Promise<boolean> {
    this.refresh();
    if (this.prompts >= this.config.maxPrompts) return false;
    this.prompts += 1;
    return true;
  }

  async reserveOutput(requestedChars: number): Promise<number> {
    this.refresh();
    const remaining = Math.max(0, this.config.maxOutputChars - this.outputChars);
    const granted = Math.min(Math.max(0, requestedChars), remaining);
    this.outputChars += granted;
    return granted;
  }

  async healthCheck(): Promise<void> {
    return Promise.resolve();
  }
}

export interface SupabaseBudgetOptions extends DailyLimitConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  rpcName: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

type BudgetMetric = "calls" | "output_chars" | "prompts";

/**
 * Shared production budget backed by one atomic Supabase RPC. Any network,
 * authentication, schema, or response error throws so callers fail closed.
 */
export class SupabaseDailyBudget implements UsageBudget {
  private readonly options: SupabaseBudgetOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseBudgetOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async reserveCall(): Promise<boolean> {
    return (await this.reserve("calls", 1, this.options.maxCalls)) === 1;
  }

  async reservePrompt(): Promise<boolean> {
    return (await this.reserve("prompts", 1, this.options.maxPrompts)) === 1;
  }

  async reserveOutput(requestedChars: number): Promise<number> {
    if (!Number.isSafeInteger(requestedChars) || requestedChars < 0) {
      throw new Error("Invalid output reservation");
    }
    return this.reserve("output_chars", requestedChars, this.options.maxOutputChars);
  }

  async healthCheck(): Promise<void> {
    await this.reserve("calls", 0, this.options.maxCalls);
  }

  private async reserve(metric: BudgetMetric, requested: number, limit: number): Promise<number> {
    const endpoint = new URL(
      `rest/v1/rpc/${encodeURIComponent(this.options.rpcName)}`,
      this.options.supabaseUrl.endsWith("/")
        ? this.options.supabaseUrl
        : `${this.options.supabaseUrl}/`,
    );
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        apikey: this.options.serviceRoleKey,
        authorization: `Bearer ${this.options.serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_limit: limit,
        p_metric: metric,
        p_requested: requested,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) throw new Error("Shared budget unavailable");

    const value: unknown = await response.json();
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > requested) {
      throw new Error("Invalid shared budget response");
    }
    return value as number;
  }
}
