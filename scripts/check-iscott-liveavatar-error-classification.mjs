import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  classifyLiveAvatarProviderError,
  readLiveAvatarProviderError,
} from "../src/lib/liveAvatarProviderErrors.ts";

const explicitCredits = readLiveAvatarProviderError(JSON.stringify({ code: 4007, message: "Insufficient credit balance" }));
assert.equal(classifyLiveAvatarProviderError(400, explicitCredits), "account_credit_exhausted");
assert.equal(
  classifyLiveAvatarProviderError(400, readLiveAvatarProviderError('{"code":400,"message":"Session validation failed"}')),
  "provider_rejected_request",
);
assert.equal(classifyLiveAvatarProviderError(429, { providerCode: null, providerMessage: null }), "rate_limited");
assert.deepEqual(readLiveAvatarProviderError("not-json"), { providerCode: null, providerMessage: null });
assert.equal(readLiveAvatarProviderError(JSON.stringify({ message: `bad\n${"x".repeat(300)}` })).providerMessage.length, 240);
assert.deepEqual(
  readLiveAvatarProviderError(JSON.stringify({
    code: 4000,
    data: [{ loc: ["context_id"], message: "Context not found", params: { context_id: "secret-ish-id" } }],
    message: "Errors validating session token",
  })),
  { providerCode: 4000, providerMessage: "Context not found" },
  "nested provider validation detail is retained without logging loc, params, or the raw body",
);

const proxy = await fs.readFile(new URL("../app/api/v1/sessions/[...path]/route.ts", import.meta.url), "utf8");
const avatar = await fs.readFile(new URL("../app/pages/avatar-iscott/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(proxy, /vendorBody/);
assert.match(proxy, /providerCode: providerError\.providerCode/);
assert.match(proxy, /providerMessage: providerError\.providerMessage/);
assert.match(proxy, /X-WildWorks-LiveAvatar-Error-Class/);
assert.match(avatar, /API request failed/);
assert.match(avatar, /Add credits to your LiveAvatar account/);
assert.match(avatar, /latestStartFailureClass === "account_credit_exhausted"/);
assert.match(avatar, /iScott couldn't start\. Tap Talk to try again\./);

console.log("iScott LiveAvatar error classification checks passed");
