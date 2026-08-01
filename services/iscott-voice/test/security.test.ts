import assert from "node:assert/strict";
import test from "node:test";
import { verifyTwilioSignature } from "../src/security.ts";

test("validates a signature only for the exact canonical WSS URL", () => {
  const authToken = "test-auth-token";
  const canonicalUrl = "wss://voice.example.test/twilio/conversationrelay";
  // Fixed independently generated Twilio signature vector for the exact WSS URL.
  const signature = "CQ2LJbbsX+AabEbzZLg29Kp6TrE=";
  assert.equal(
    verifyTwilioSignature({ canonicalUrl, requestUrl: canonicalUrl, signature, authToken }),
    true,
  );
  assert.equal(
    verifyTwilioSignature({
      canonicalUrl,
      requestUrl: `${canonicalUrl}?unexpected=1`,
      signature,
      authToken,
    }),
    false,
  );
  assert.equal(
    verifyTwilioSignature({ canonicalUrl, requestUrl: canonicalUrl, signature: undefined, authToken }),
    false,
  );
});
