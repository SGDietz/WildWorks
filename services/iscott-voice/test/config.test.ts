import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.ts";

const required = {
  PUBLIC_WSS_URL: "wss://voice.example.test/twilio/conversationrelay",
  TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "test-token",
};

test("AI is disabled and call duration is capped at 120 seconds by default", () => {
  const config = loadConfig(required);
  assert.equal(config.aiEnabled, false);
  assert.equal(config.callMaxSeconds, 120);
  assert.equal(config.callMaxMessages, 64);
  assert.equal(config.callMaxPrompts, 10);
  assert.equal(config.dailyMaxCalls, 3);
  assert.equal(config.dailyMaxPrompts, 30);
  assert.equal(config.dailyMaxOutputChars, 25_000);
  assert.equal(config.port, 10_000);
  assert.equal(config.budgetBackend, "memory");
});

test("rejects AI enablement without a complete compatible endpoint configuration", () => {
  assert.throws(() => loadConfig({ ...required, AI_ENABLED: "true" }), /incomplete/);
  assert.throws(
    () => loadConfig({ ...required, CALL_MAX_SECONDS: "121" }),
    /CALL_MAX_SECONDS/,
  );
});

test("accepts an explicit OpenAI-compatible model endpoint", () => {
  const config = loadConfig({
    ...required,
    PUBLIC_WSS_URL:
      "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay",
    AI_ENABLED: "true",
    LLM_ENDPOINT_URL: "https://api.openai.com/v1/chat/completions",
    LLM_API_KEY: "test-key",
    LLM_MODEL: "gpt-test",
  });
  assert.equal(config.llmEndpointUrl, "https://api.openai.com/v1/chat/completions");
});

test("production requires the shared Supabase budget and complete credentials", () => {
  assert.throws(
    () => loadConfig({ ...required, NODE_ENV: "production" }),
    /BUDGET_BACKEND=supabase/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...required,
        NODE_ENV: "production",
        BUDGET_BACKEND: "supabase",
      }),
    /Supabase budget configuration is incomplete/,
  );
  const config = loadConfig({
    ...required,
    PUBLIC_WSS_URL:
      "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay",
    NODE_ENV: "production",
    BUDGET_BACKEND: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-secret",
    WILDWORKS_VOICE_EVENT_URL:
      "https://www.wildworks.live/api/internal/voice-events",
    WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
    WILDWORKS_VOICE_CRON_SECRET: "c".repeat(32),
  });
  assert.equal(config.budgetBackend, "supabase");
});

test("production requires a complete HTTPS WildWorks runtime event endpoint", () => {
  const production = {
    ...required,
    PUBLIC_WSS_URL:
      "wss://wildworks-iscott-voice.onrender.com/twilio/conversationrelay",
    NODE_ENV: "production",
    BUDGET_BACKEND: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-secret",
  };
  assert.throws(() => loadConfig(production), /voice event delivery/);
  assert.throws(
    () =>
      loadConfig({
        ...production,
        WILDWORKS_VOICE_EVENT_URL:
          "http://www.wildworks.live/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
      }),
    /must use https/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        WILDWORKS_VOICE_EVENT_URL: "https://www.wildworks.live/wrong-path",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
      }),
    /Invalid WILDWORKS_VOICE_EVENT_URL/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        WILDWORKS_VOICE_EVENT_URL:
          "https://localhost/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
      }),
    /must be public/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        WILDWORKS_VOICE_EVENT_URL:
          "https://example.com/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
      }),
    /must use a WildWorks host/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        WILDWORKS_VOICE_EVENT_URL:
          "https://www.wildworks.live/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
      }),
    /voice maintenance authentication/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        PUBLIC_WSS_URL: "wss://example.com/twilio/conversationrelay",
        WILDWORKS_VOICE_EVENT_URL:
          "https://www.wildworks.live/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
        WILDWORKS_VOICE_CRON_SECRET: "c".repeat(32),
      }),
    /must use the WildWorks Render service endpoint/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...production,
        AI_ENABLED: "true",
        LLM_ENDPOINT_URL: "https://example.com/v1/chat/completions",
        LLM_API_KEY: "test-api-key",
        LLM_MODEL: "gpt-4.1-mini",
        WILDWORKS_VOICE_EVENT_URL:
          "https://www.wildworks.live/api/internal/voice-events",
        WILDWORKS_VOICE_EVENT_SECRET: "v".repeat(32),
        WILDWORKS_VOICE_CRON_SECRET: "c".repeat(32),
      }),
    /must be https:\/\/api\.openai\.com\/v1\/chat\/completions/,
  );
});
