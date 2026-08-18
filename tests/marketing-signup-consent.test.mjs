/* T02 regression tests - Twilio toll-free verification corrections.
   Intended repo path: tests/marketing-signup-consent.test.mjs
   Run: node --test tests/marketing-signup-consent.test.mjs
   (matches the repo's existing plain node:test files in tests/) */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCEPTED_SIGNUP_CHANNELS,
  SIGNUP_CHANNEL_OPTIONS,
  consentColumns,
  hasStorableContact,
  optInColumns,
  parseMarketingConsent,
  requestedChannels,
  signupDeliveryPlan,
  signupResultMessage,
  signupSmsBody,
} from "../src/lib/marketingConsent.mjs";

/* ---------- requirement 3: the two consents are separate ---------- */

test("marketing and service consent are read independently", () => {
  assert.deepEqual(
    { ...parseMarketingConsent({ consentMarketing: true, consentServiceUpdates: false }) },
    { marketing: true, service: false, any: true, legacy: false },
  );
  assert.deepEqual(
    { ...parseMarketingConsent({ consentMarketing: false, consentServiceUpdates: true }) },
    { marketing: false, service: true, any: true, legacy: false },
  );
  assert.deepEqual(
    { ...parseMarketingConsent({ consentMarketing: true, consentServiceUpdates: true }) },
    { marketing: true, service: true, any: true, legacy: false },
  );
});

test("service consent alone never implies marketing consent", () => {
  const consent = parseMarketingConsent({ consentServiceUpdates: true });
  assert.equal(consent.marketing, false);
  assert.equal(signupSmsBody(consent).includes("offers"), false);
});

test("a stale tab posting the old single box is treated as both, not as nothing", () => {
  const consent = parseMarketingConsent({ consent: true });
  assert.deepEqual({ ...consent }, { marketing: true, service: true, any: true, legacy: true });
});

/* ---------- requirement 4: consent is optional ---------- */

test("no boxes ticked still produces a valid, saveable signup", () => {
  const consent = parseMarketingConsent({});
  assert.equal(consent.any, false);
  const plan = signupDeliveryPlan({ channel: "both", consent });
  assert.equal(plan.wantsEmail, true);
  assert.equal(plan.wantsSms, true);
  assert.equal(plan.sendEmail, false);
  assert.equal(plan.sendSms, false);
  assert.equal(plan.emailStatus, "not_requested");
  assert.equal(plan.smsStatus, "not_requested");
});

test("no consent means nothing is sent on any channel", () => {
  const consent = parseMarketingConsent({});
  for (const channel of ["email", "sms", "both"]) {
    const plan = signupDeliveryPlan({ channel, consent });
    assert.equal(plan.sendEmail, false, channel);
    assert.equal(plan.sendSms, false, channel);
  }
  assert.equal(signupSmsBody(consent), null);
});

test("the no-consent visitor is told plainly that nothing will be sent", () => {
  const consent = parseMarketingConsent({});
  const plan = signupDeliveryPlan({ channel: "both", consent });
  const message = signupResultMessage({ plan, consent });
  assert.match(message, /will not text or email you/i);
});

/* ---------- delivery still works when consent is given ---------- */

test("either consent alone is enough to deliver the channel the visitor chose", () => {
  for (const body of [{ consentMarketing: true }, { consentServiceUpdates: true }]) {
    const consent = parseMarketingConsent(body);
    assert.equal(signupDeliveryPlan({ channel: "email", consent }).sendEmail, true);
    assert.equal(signupDeliveryPlan({ channel: "sms", consent }).sendSms, true);
    const both = signupDeliveryPlan({ channel: "both", consent });
    assert.equal(both.sendEmail, true);
    assert.equal(both.sendSms, true);
  }
});

test("channel selection still bounds delivery", () => {
  const consent = parseMarketingConsent({ consentMarketing: true, consentServiceUpdates: true });
  const emailOnly = signupDeliveryPlan({ channel: "email", consent });
  assert.equal(emailOnly.sendSms, false);
  const smsOnly = signupDeliveryPlan({ channel: "sms", consent });
  assert.equal(smsOnly.sendEmail, false);
  assert.deepEqual(requestedChannels("both"), { email: true, sms: true });
});

/* ---------- the SMS body describes only what was agreed to ---------- */

test("the confirmation SMS lists only the consented categories", () => {
  const service = signupSmsBody(parseMarketingConsent({ consentServiceUpdates: true }));
  assert.match(service, /project follow-up, scheduling, reminders, and service updates/);
  assert.doesNotMatch(service, /offers/);

  const marketing = signupSmsBody(parseMarketingConsent({ consentMarketing: true }));
  assert.match(marketing, /design ideas, offers, and news/);
  assert.doesNotMatch(marketing, /scheduling/);

  const both = signupSmsBody(parseMarketingConsent({ consentMarketing: true, consentServiceUpdates: true }));
  assert.match(both, /service updates/);
  assert.match(both, /offers/);
});

test("every confirmation SMS keeps the required disclosures verbatim", () => {
  for (const body of [{ consentMarketing: true }, { consentServiceUpdates: true }, { consentMarketing: true, consentServiceUpdates: true }]) {
    const sms = signupSmsBody(parseMarketingConsent(body));
    assert.match(sms, /Message frequency varies\./);
    assert.match(sms, /Message and data rates may apply\./);
    assert.match(sms, /Reply HELP for help or STOP to cancel\./);
  }
});

/* ---------- what gets written to the ledger ---------- */

test("consent columns record both flags and the version", () => {
  const consent = parseMarketingConsent({ consentServiceUpdates: true });
  const row = consentColumns(consent, "2026-08-18", new Date("2026-08-18T12:00:00Z"));
  assert.deepEqual(row, {
    marketing_consent: false,
    service_consent: true,
    consent_version: "2026-08-18",
    consented_at: "2026-08-18T12:00:00.000Z",
  });
});

/* ---------- requirement 1, the code half ---------- */

test("the signup confirmation may only be sent from a WildWorks-domain address", async () => {
  const { wildWorksSenderConfigurationError } = await import("../src/lib/wildworksEmailIdentity.mjs");
  const key = { RESEND_API_KEY: "re_test_key" };
  assert.equal(wildWorksSenderConfigurationError({ ...key, RESEND_FROM_EMAIL: "hello@wildworks.ai" }), null);
  assert.equal(
    wildWorksSenderConfigurationError({ ...key, RESEND_FROM_EMAIL: "scott@gmail.com" }),
    "wildworks_sender_domain_mismatch",
  );
});

/* ---------- installer review: the ledger must not claim a false opt-in ---------- */

test("no consent means both opt-in columns are false, whatever channel was chosen", () => {
  const consent = parseMarketingConsent({});
  for (const channel of ["email", "sms", "both"]) {
    const plan = signupDeliveryPlan({ channel, consent });
    assert.deepEqual(optInColumns(plan), { email_opt_in: false, sms_opt_in: false }, channel);
  }
});

test("opt-in columns follow consent AND channel, never the channel alone", () => {
  const consent = parseMarketingConsent({ consentServiceUpdates: true });
  assert.deepEqual(optInColumns(signupDeliveryPlan({ channel: "email", consent })), {
    email_opt_in: true,
    sms_opt_in: false,
  });
  assert.deepEqual(optInColumns(signupDeliveryPlan({ channel: "sms", consent })), {
    email_opt_in: false,
    sms_opt_in: true,
  });
  assert.deepEqual(optInColumns(signupDeliveryPlan({ channel: "both", consent })), {
    email_opt_in: true,
    sms_opt_in: true,
  });
});

test("a no-consent row is still saveable: it carries a contact value", () => {
  assert.equal(hasStorableContact({ email: "someone@example.com", phone: null }), true);
  assert.equal(hasStorableContact({ email: null, phone: "+14435551234" }), true);
  assert.equal(hasStorableContact({ email: null, phone: null }), false);
  assert.equal(hasStorableContact({ email: "   ", phone: "" }), false);
});

test("the relaxed table CHECK accepts the no-consent row and still rejects a lying one", () => {
  // mirrors marketing_signups_contact_and_optin_check
  const passes = (row) =>
    ((row.email && row.email !== "") || (row.phone_e164 && row.phone_e164 !== "")) &&
    (!row.email_opt_in || (row.email && row.email !== "")) &&
    (!row.sms_opt_in || (row.phone_e164 && row.phone_e164 !== ""));

  const consent = parseMarketingConsent({});
  const plan = signupDeliveryPlan({ channel: "sms", consent });
  const noConsentRow = { email: null, phone_e164: "+14435551234", ...optInColumns(plan) };
  assert.equal(Boolean(passes(noConsentRow)), true);

  assert.equal(Boolean(passes({ email: null, phone_e164: null, email_opt_in: false, sms_opt_in: false })), false);
  assert.equal(Boolean(passes({ email: null, phone_e164: "+14435551234", email_opt_in: true, sms_opt_in: false })), false);
  assert.equal(Boolean(passes({ email: "a@b.co", phone_e164: null, email_opt_in: false, sms_opt_in: true })), false);
});

/* ---------- G 2026-08-18: only Email and SMS are offered ---------- */

test("the form offers exactly Email and SMS - Both is gone", () => {
  assert.deepEqual(SIGNUP_CHANNEL_OPTIONS.map((option) => option.id), ["email", "sms"]);
  assert.deepEqual(SIGNUP_CHANNEL_OPTIONS.map((option) => option.label), ["Email", "SMS"]);
  assert.equal(SIGNUP_CHANNEL_OPTIONS.some((option) => option.id === "both"), false);
});

test("the backend still accepts a legacy channel=both from a stale tab", () => {
  assert.equal(ACCEPTED_SIGNUP_CHANNELS.includes("both"), true);
  assert.deepEqual(requestedChannels("both"), { email: true, sms: true });
  const consent = parseMarketingConsent({ consentMarketing: true });
  const plan = signupDeliveryPlan({ channel: "both", consent });
  assert.equal(plan.sendEmail, true);
  assert.equal(plan.sendSms, true);
  assert.deepEqual(optInColumns(plan), { email_opt_in: true, sms_opt_in: true });
});

test("a stale tab that posts channel=both with the old single consent box still works end to end", () => {
  const consent = parseMarketingConsent({ consent: true });
  const plan = signupDeliveryPlan({ channel: "both", consent });
  assert.equal(consent.legacy, true);
  assert.deepEqual(optInColumns(plan), { email_opt_in: true, sms_opt_in: true });
  assert.match(signupSmsBody(consent), /service updates, design ideas, offers, and news/);
});

/* ---------- rev 3: consent timestamps must not be invented ---------- */

test("no consent stores consented_at as null, not now()", () => {
  const consent = parseMarketingConsent({});
  const row = consentColumns(consent, "2026-08-18", new Date("2026-08-18T12:00:00Z"));
  assert.equal(row.consented_at, null);
  assert.equal(row.marketing_consent, false);
  assert.equal(row.service_consent, false);
  // the version is still recorded: we know which wording they were shown
  assert.equal(row.consent_version, "2026-08-18");
});

test("a legacy single-box payload is still a real consent and is stamped", () => {
  const row = consentColumns(parseMarketingConsent({ consent: true }), "2026-08-18", new Date("2026-08-18T12:00:00Z"));
  assert.equal(row.consented_at, "2026-08-18T12:00:00.000Z");
});

test("either box alone stamps consented_at", () => {
  for (const body of [{ consentMarketing: true }, { consentServiceUpdates: true }]) {
    const row = consentColumns(parseMarketingConsent(body), "2026-08-18", new Date("2026-08-18T12:00:00Z"));
    assert.equal(row.consented_at, "2026-08-18T12:00:00.000Z");
  }
});

test("a no-consent row is internally consistent: no flags, no timestamp, no delivery", () => {
  const consent = parseMarketingConsent({});
  const plan = signupDeliveryPlan({ channel: "sms", consent });
  const row = { ...optInColumns(plan), ...consentColumns(consent, "2026-08-18") };
  assert.deepEqual(row, {
    email_opt_in: false,
    sms_opt_in: false,
    marketing_consent: false,
    service_consent: false,
    consent_version: "2026-08-18",
    consented_at: null,
  });
  assert.equal(signupSmsBody(consent), null);
});

/* ---------- rev 3: the channel error names only what the form offers ---------- */

test("the invalid-channel error mentions Email and SMS, never Both", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const route = fs.readFileSync(path.join(here, "..", "app", "api", "marketing-signups", "route.ts"), "utf8");
  const match = route.match(/error: "(Choose[^"]+)"/);
  assert.ok(match, "the invalid-channel error message should still exist");
  assert.equal(match[1], "Choose Email or SMS before joining the list.");
  assert.doesNotMatch(match[1], /both/i);
});

