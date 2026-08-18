import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWildWorksSenderAddress,
  wildWorksSenderConfigurationError,
} from "../src/lib/wildworksEmailIdentity.mjs";

const configured = { RESEND_API_KEY: "re_test_key" };

test("accepts plain WildWorks sender identities", () => {
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "notifications@wildworks.ai",
  }), null);
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "alerts@wildworks.live",
  }), null);
});

test("accepts a WildWorks display name", () => {
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "WildWorks <notifications@wildworks.ai>",
  }), null);
});

test("rejects iSolve and aiASAP senders", () => {
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "notifications@isolveurproblems.ai",
  }), "wildworks_sender_domain_mismatch");
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "notifications@aiasap.ai",
  }), "wildworks_sender_domain_mismatch");
});

test("rejects WildWorks subdomains", () => {
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "notifications@mail.wildworks.ai",
  }), "wildworks_sender_domain_mismatch");
});

test("rejects incomplete configuration and malformed angle syntax", () => {
  assert.equal(wildWorksSenderConfigurationError({
    RESEND_FROM_EMAIL: "notifications@wildworks.ai",
  }), "resend_not_configured");
  assert.equal(wildWorksSenderConfigurationError({
    ...configured,
    RESEND_FROM_EMAIL: "WildWorks <notifications@wildworks.ai",
  }), "resend_not_configured");
});

test("sender parser preserves the address Resend receives", () => {
  assert.equal(
    parseWildWorksSenderAddress("WildWorks <notifications@wildworks.ai>"),
    "notifications@wildworks.ai",
  );
});
