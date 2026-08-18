/* Marketing signup consent model - Twilio toll-free verification corrections.
   Intended repo path: src/lib/marketingConsent.mjs

   Twilio requires marketing consent and non-marketing (service) consent to be
   separate boxes, and neither may be required to submit the form. This module
   holds the whole rule set as pure functions so the route stays thin and the
   behaviour is testable without a database, a browser, or a provider key.

   Rev 2 (installer review): the opt-in columns are derived from CONSENT, never
   from the channel buttons. Choosing "SMS" is a request, not permission - a row
   with no consent is stored with email_opt_in = false and sms_opt_in = false, so
   the ledger tells the truth.

   Nothing here sends anything. */

/** The channel buttons the form shows. "both" is legacy: accepted, never offered. */
export const SIGNUP_CHANNEL_OPTIONS = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
];

/** Every channel value the API accepts, including the retired "both". */
export const ACCEPTED_SIGNUP_CHANNELS = ["email", "sms", "both"];

/** Consent as the form submits it. Neither box is required. */
export function parseMarketingConsent(body) {
  const marketing = body?.consentMarketing === true;
  const service = body?.consentServiceUpdates === true;
  // Legacy single-box payload (pre-2026-08-18 clients still in a stale tab):
  // treat it as both, because that is exactly what the old copy described.
  const legacy = marketing === false && service === false && body?.consent === true;
  const resolved = legacy ? { marketing: true, service: true } : { marketing, service };
  return { ...resolved, any: resolved.marketing || resolved.service, legacy };
}

/** Which channels the visitor asked for. "both" still resolves for stale tabs. */
export function requestedChannels(channel) {
  return {
    email: channel === "email" || channel === "both",
    sms: channel === "sms" || channel === "both",
  };
}

/** What we may actually send. No consent means we store the choice and send nothing. */
export function signupDeliveryPlan({ channel, consent }) {
  const wants = requestedChannels(channel);
  const sendEmail = wants.email && consent.any;
  const sendSms = wants.sms && consent.any;
  return {
    wantsEmail: wants.email,
    wantsSms: wants.sms,
    sendEmail,
    sendSms,
    emailStatus: sendEmail ? "pending" : "not_requested",
    smsStatus: sendSms ? "pending" : "not_requested",
  };
}

/** The ledger's opt-in flags. A channel is opted in only with consent behind it. */
export function optInColumns(plan) {
  return {
    email_opt_in: plan.sendEmail,
    sms_opt_in: plan.sendSms,
  };
}

const SERVICE_TOPICS = "project follow-up, scheduling, reminders, and service updates";
const MARKETING_TOPICS = "design ideas, offers, and news";
const DISCLOSURE =
  "Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to cancel.";

/** The confirmation SMS describes only what the visitor actually agreed to. */
export function signupSmsBody(consent) {
  if (!consent.any) return null;
  const topics =
    consent.marketing && consent.service
      ? `${SERVICE_TOPICS}, ${MARKETING_TOPICS}`
      : consent.service
        ? SERVICE_TOPICS
        : MARKETING_TOPICS;
  return `WildWorks: You're subscribed to ${topics}. ${DISCLOSURE}`;
}

/**
 * Consent fields for public.marketing_signups.
 *
 * Rev 3 (installer review): consented_at is a record of consent, so it is null
 * when no consent was given. Stamping now() on a no-consent row would timestamp
 * something that never happened - the exact kind of record Twilio audits.
 */
export function consentColumns(consent, consentVersion, now = new Date()) {
  return {
    marketing_consent: consent.marketing,
    service_consent: consent.service,
    consent_version: consentVersion,
    consented_at: consent.any ? now.toISOString() : null,
  };
}

/**
 * The row must still carry a contact value the visitor typed, whatever the
 * consent state - that is what the relaxed table CHECK enforces server-side.
 */
export function hasStorableContact({ email, phone }) {
  return Boolean((email && email.trim()) || (phone && phone.trim()));
}

/** What the visitor is told after a save. */
export function signupResultMessage({ plan, consent }) {
  if (!consent.any) {
    return "Saved. You did not opt in to messages, so WildWorks will not text or email you. Tick a box any time to start.";
  }
  if (plan.sendEmail && plan.sendSms) return "You're signed up. Check your inbox and phone for confirmation.";
  if (plan.sendSms) return "You're signed up. Check your phone for confirmation.";
  return "You're signed up. Check your inbox for confirmation.";
}

