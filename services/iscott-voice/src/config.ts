export type BudgetBackend = "memory" | "supabase";

export interface VoiceConfig {
  nodeEnv: "development" | "production" | "test";
  host: string;
  port: number;
  publicWssUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  aiEnabled: boolean;
  llmEndpointUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmTimeoutMs: number;
  llmMaxTokens: number;
  callMaxSeconds: number;
  callMaxMessages: number;
  callMaxPrompts: number;
  callMaxInputChars: number;
  callMaxOutputChars: number;
  callMaxContextMessages: number;
  responseChunkChars: number;
  dailyMaxCalls: number;
  dailyMaxPrompts: number;
  dailyMaxOutputChars: number;
  budgetBackend: BudgetBackend;
  budgetTimeoutMs: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseBudgetRpc: string;
  voiceEventUrl: string;
  voiceEventSecret: string;
  voiceEventTimeoutMs: number;
  voiceEventMaxAttempts: number;
  voiceEventRetryBaseMs: number;
  voiceMaintenanceUrl: string;
  voiceCronSecret: string;
  voiceMaintenanceIntervalMs: number;
  voiceMaintenanceTimeoutMs: number;
  shutdownHandoffGraceMs: number;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function boolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid ${name}`);
}

function oneOf<T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: T,
  values: readonly T[],
): T {
  const value = (env[name]?.trim() || fallback) as T;
  if (!values.includes(value)) throw new Error(`Invalid ${name}`);
  return value;
}

function httpsUrl(value: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${name}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use https`);
  if (parsed.username || parsed.password || parsed.hash) throw new Error(`Invalid ${name}`);
  return parsed;
}

function voiceEventUrl(value: string, nodeEnv: VoiceConfig["nodeEnv"]): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid WILDWORKS_VOICE_EVENT_URL");
  }
  const isLoopbackDevelopment =
    nodeEnv !== "production" &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLoopbackDevelopment) {
    throw new Error("WILDWORKS_VOICE_EVENT_URL must use https");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.search ||
    parsed.pathname !== "/api/internal/voice-events"
  ) {
    throw new Error("Invalid WILDWORKS_VOICE_EVENT_URL");
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VoiceConfig {
  const nodeEnv = oneOf(env, "NODE_ENV", "development", [
    "development",
    "production",
    "test",
  ] as const);
  const aiEnabled = boolean(env, "AI_ENABLED", false);
  const budgetBackend = oneOf(env, "BUDGET_BACKEND", "memory", [
    "memory",
    "supabase",
  ] as const);
  const runtimeEventUrl = env.WILDWORKS_VOICE_EVENT_URL?.trim() || "";
  const runtimeEventSecret = env.WILDWORKS_VOICE_EVENT_SECRET?.trim() || "";
  const voiceCronSecret = env.WILDWORKS_VOICE_CRON_SECRET?.trim() || "";
  if (Boolean(runtimeEventUrl) !== Boolean(runtimeEventSecret)) {
    throw new Error("WildWorks voice event configuration is incomplete");
  }
  const parsedRuntimeEventUrl = runtimeEventUrl
    ? voiceEventUrl(runtimeEventUrl, nodeEnv)
    : undefined;
  if (
    runtimeEventSecret &&
    (Buffer.byteLength(runtimeEventSecret, "utf8") < 32 ||
      Buffer.byteLength(runtimeEventSecret, "utf8") > 512)
  ) {
    throw new Error("Invalid WILDWORKS_VOICE_EVENT_SECRET");
  }
  if (
    voiceCronSecret &&
    (Buffer.byteLength(voiceCronSecret, "utf8") < 32 ||
      Buffer.byteLength(voiceCronSecret, "utf8") > 512)
  ) {
    throw new Error("Invalid WILDWORKS_VOICE_CRON_SECRET");
  }
  const publicWssUrl = required(env, "PUBLIC_WSS_URL");
  const parsedUrl = new URL(publicWssUrl);
  if (parsedUrl.protocol !== "wss:") throw new Error("PUBLIC_WSS_URL must use wss");
  if (parsedUrl.username || parsedUrl.password || parsedUrl.hash) {
    throw new Error("Invalid PUBLIC_WSS_URL");
  }

  const twilioAccountSid = required(env, "TWILIO_ACCOUNT_SID");
  if (!/^AC[a-fA-F0-9]{32}$/.test(twilioAccountSid)) {
    throw new Error("Invalid TWILIO_ACCOUNT_SID");
  }

  const config: VoiceConfig = {
    nodeEnv,
    host: env.HOST?.trim() || "0.0.0.0",
    port: integer(env, "PORT", 10_000, 1, 65_535),
    publicWssUrl,
    twilioAccountSid,
    twilioAuthToken: required(env, "TWILIO_AUTH_TOKEN"),
    aiEnabled,
    llmEndpointUrl: env.LLM_ENDPOINT_URL?.trim() || "",
    llmApiKey: env.LLM_API_KEY?.trim() || "",
    llmModel: env.LLM_MODEL?.trim() || "",
    llmTimeoutMs: integer(env, "LLM_TIMEOUT_MS", 12_000, 500, 60_000),
    llmMaxTokens: integer(env, "LLM_MAX_TOKENS", 320, 32, 2_000),
    callMaxSeconds: integer(env, "CALL_MAX_SECONDS", 120, 15, 120),
    callMaxMessages: integer(env, "CALL_MAX_MESSAGES", 64, 4, 500),
    callMaxPrompts: integer(env, "CALL_MAX_PROMPTS", 10, 1, 100),
    callMaxInputChars: integer(env, "CALL_MAX_INPUT_CHARS", 12_000, 256, 100_000),
    callMaxOutputChars: integer(env, "CALL_MAX_OUTPUT_CHARS", 16_000, 256, 100_000),
    callMaxContextMessages: integer(env, "CALL_MAX_CONTEXT_MESSAGES", 12, 2, 40),
    responseChunkChars: integer(env, "RESPONSE_CHUNK_CHARS", 120, 20, 500),
    dailyMaxCalls: integer(env, "DAILY_MAX_CALLS", 3, 1, 100_000),
    dailyMaxPrompts: integer(env, "DAILY_MAX_PROMPTS", 30, 1, 1_000_000),
    dailyMaxOutputChars: integer(
      env,
      "DAILY_MAX_OUTPUT_CHARS",
      25_000,
      1_000,
      100_000_000,
    ),
    budgetBackend,
    budgetTimeoutMs: integer(env, "BUDGET_TIMEOUT_MS", 3_000, 250, 10_000),
    supabaseUrl: env.SUPABASE_URL?.trim() || "",
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    supabaseBudgetRpc:
      env.SUPABASE_BUDGET_RPC?.trim() || "reserve_iscott_voice_daily_usage",
    voiceEventUrl: runtimeEventUrl,
    voiceEventSecret: runtimeEventSecret,
    voiceEventTimeoutMs: integer(
      env,
      "WILDWORKS_VOICE_EVENT_TIMEOUT_MS",
      1_500,
      250,
      5_000,
    ),
    voiceEventMaxAttempts: integer(
      env,
      "WILDWORKS_VOICE_EVENT_MAX_ATTEMPTS",
      3,
      1,
      4,
    ),
    voiceEventRetryBaseMs: integer(
      env,
      "WILDWORKS_VOICE_EVENT_RETRY_BASE_MS",
      100,
      10,
      1_000,
    ),
    voiceMaintenanceUrl: parsedRuntimeEventUrl
      ? new URL("/api/internal/voice-email-drain", parsedRuntimeEventUrl.origin).toString()
      : "",
    voiceCronSecret,
    voiceMaintenanceIntervalMs:
      integer(
        env,
        "WILDWORKS_VOICE_MAINTENANCE_INTERVAL_SECONDS",
        300,
        60,
        3_600,
      ) * 1_000,
    voiceMaintenanceTimeoutMs: integer(
      env,
      "WILDWORKS_VOICE_MAINTENANCE_TIMEOUT_MS",
      5_000,
      500,
      15_000,
    ),
    shutdownHandoffGraceMs: integer(
      env,
      "SHUTDOWN_HANDOFF_GRACE_MS",
      1_000,
      100,
      5_000,
    ),
  };

  if (aiEnabled && (!config.llmEndpointUrl || !config.llmApiKey || !config.llmModel)) {
    throw new Error("AI is enabled but LLM configuration is incomplete");
  }
  if (config.llmEndpointUrl) {
    const llmUrl = httpsUrl(config.llmEndpointUrl, "LLM_ENDPOINT_URL");
    if (llmUrl.search) throw new Error("LLM_ENDPOINT_URL must not contain a query string");
    if (
      nodeEnv === "production" &&
      (llmUrl.hostname !== "api.openai.com" ||
        llmUrl.pathname !== "/v1/chat/completions" ||
        llmUrl.port)
    ) {
      throw new Error(
        "Production LLM_ENDPOINT_URL must be https://api.openai.com/v1/chat/completions",
      );
    }
  }

  if (budgetBackend === "supabase") {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error("Supabase budget configuration is incomplete");
    }
    const supabaseUrl = httpsUrl(config.supabaseUrl, "SUPABASE_URL");
    if (supabaseUrl.search) throw new Error("SUPABASE_URL must not contain a query string");
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(config.supabaseBudgetRpc)) {
      throw new Error("Invalid SUPABASE_BUDGET_RPC");
    }
  }

  if (nodeEnv === "production") {
    if (config.host !== "0.0.0.0") throw new Error("Production HOST must be 0.0.0.0");
    if (budgetBackend !== "supabase") {
      throw new Error("Production requires BUDGET_BACKEND=supabase");
    }
    if (["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
      throw new Error("Production PUBLIC_WSS_URL must be public");
    }
    if (
      parsedUrl.hostname !== "wildworks-iscott-voice.onrender.com" ||
      parsedUrl.pathname !== "/twilio/conversationrelay" ||
      parsedUrl.search ||
      parsedUrl.port
    ) {
      throw new Error(
        "Production PUBLIC_WSS_URL must use the WildWorks Render service endpoint",
      );
    }
    if (!config.voiceEventUrl || !config.voiceEventSecret) {
      throw new Error("Production requires WildWorks voice event delivery");
    }
    if (
      parsedRuntimeEventUrl &&
      ["localhost", "127.0.0.1", "::1"].includes(parsedRuntimeEventUrl.hostname)
    ) {
      throw new Error("Production WILDWORKS_VOICE_EVENT_URL must be public");
    }
    if (
      parsedRuntimeEventUrl &&
      (!["wildworks.live", "www.wildworks.live"].includes(
        parsedRuntimeEventUrl.hostname,
      ) ||
        parsedRuntimeEventUrl.port)
    ) {
      throw new Error("Production WILDWORKS_VOICE_EVENT_URL must use a WildWorks host");
    }
    if (!config.voiceCronSecret) {
      throw new Error("Production requires WildWorks voice maintenance authentication");
    }
  }

  return config;
}
