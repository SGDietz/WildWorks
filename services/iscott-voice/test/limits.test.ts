import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseDailyBudget } from "../src/limits.ts";

function createBudget(fetchImpl: typeof fetch): SupabaseDailyBudget {
  return new SupabaseDailyBudget({
    maxCalls: 5,
    maxPrompts: 20,
    maxOutputChars: 10_000,
    supabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "test-service-role-secret",
    rpcName: "reserve_iscott_voice_daily_usage",
    timeoutMs: 1_000,
    fetchImpl,
  });
}

test("Supabase budget uses the atomic RPC and accepts only its bounded grant", async () => {
  let observedUrl = "";
  let observedBody: unknown;
  const budget = createBudget(async (input, init) => {
    observedUrl = input.toString();
    observedBody = JSON.parse(String(init?.body));
    return new Response("37", { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(await budget.reserveOutput(50), 37);
  assert.equal(
    observedUrl,
    "https://project.supabase.co/rest/v1/rpc/reserve_iscott_voice_daily_usage",
  );
  assert.deepEqual(observedBody, {
    p_limit: 10_000,
    p_metric: "output_chars",
    p_requested: 50,
  });
});

test("Supabase budget fails closed on HTTP errors and malformed grants", async () => {
  const unavailable = createBudget(async () => new Response("{}", { status: 503 }));
  await assert.rejects(() => unavailable.reserveCall(), /Shared budget unavailable/);

  const malformed = createBudget(async () => new Response("99", { status: 200 }));
  await assert.rejects(() => malformed.reservePrompt(), /Invalid shared budget response/);
});
