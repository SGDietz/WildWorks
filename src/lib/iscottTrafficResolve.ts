export type TrafficClass = "owner" | "test" | "public" | "bot";

export type TrafficClassification = {
  trafficClass: TrafficClass;
  reason: string;
  confidence: number;
};

const TEST_UA = /(HeadlessChrome|Playwright|Puppeteer|jsdom|Lighthouse)/i;
// G 2026-08-18: 215 "public" sessions collapsed to 45 once internal origins were
// excluded by hand. Sessions arriving from the dev server or the mission-control
// tailscale door were being counted as strangers, which made the traffic numbers
// meaningless. Anything served from a private host is our own traffic.
// 2026-08-19: the tailscale door was in this list, and that door is
// mission-control.tail00dfe0.ts.net - THE PUBLIC LINK G hands to customers.
// Anything classified by origin through it would come out "test", and a test
// lead is HELD and never reaches Scott. It has not fired yet only because origin
// is not passed on the lead path; it was one wiring change from silently eating
// every real lead the site has ever taken.
//
// The public door is not internal. Localhost and private ranges still are.
const INTERNAL_HOST = /(^|\/\/|@)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local(:|\/|$)/i;

// G, 2026-08-19: "I'm just gonna use my real name and real information from now
// on to make it easy on us. If something comes in from here on out that's not
// Scott with my phone number and my email, then yes - let's act like that's a
// new lead, because it probably is."
//
// So G identifies himself by his own contact details, and everything else is
// treated as a stranger who deserves to reach Scott. This is a far safer test
// than guessing from an origin or a user agent, because the failure mode of
// guessing wrong is a real customer being silently held.
const OWNER_PHONE_DIGITS = "4437972166";
const OWNER_EMAILS = ["sgdietz@pm.me", "scott@wildworks.ai"];

export function isOwnerContact(args: {
  email?: string | null;
  phone?: string | null;
}): boolean {
  const email = clean(args.email, 320)?.toLowerCase().trim();
  if (email && OWNER_EMAILS.includes(email)) return true;
  const digits = clean(args.phone, 40)?.replace(/\D/g, "") ?? "";
  if (digits && (digits === OWNER_PHONE_DIGITS || digits === "1" + OWNER_PHONE_DIGITS)) return true;
  return false;
}
const BOT_UA = /(googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|meta-externalagent|crawler|spider|slurp|semrushbot|ahrefsbot)/i;

function clean(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const result = value.replace(/\s+/g, " ").trim();
  return result ? result.slice(0, max) : null;
}

export function resolveTrafficClassification(args: {
  anonymousVisitorId?: string | null;
  userAgent?: string | null;
  explicitLabel?: TrafficClassification | null;
  origin?: string | null;
}): TrafficClassification {
  const anonymousVisitorId = clean(args.anonymousVisitorId, 160);
  if (anonymousVisitorId?.startsWith("codex-") || anonymousVisitorId?.startsWith("ww-test-")) {
    return { trafficClass: "test", reason: "codex_test_identifier", confidence: 1 };
  }
  if (anonymousVisitorId?.startsWith("ww-owner-")) {
    return { trafficClass: "owner", reason: "owner_test_identifier", confidence: 1 };
  }
  if (args.explicitLabel) return args.explicitLabel;
  // Internal origin beats the user-agent checks but never an explicit label or an
  // owner/codex identifier - those are deliberate and stay authoritative.
  const origin = clean(args.origin, 300) ?? "";
  if (origin && INTERNAL_HOST.test(origin)) {
    return { trafficClass: "test", reason: "internal_origin", confidence: 1 };
  }
  const userAgent = clean(args.userAgent, 900) ?? "";
  if (TEST_UA.test(userAgent)) {
    return { trafficClass: "test", reason: "automated_test_browser", confidence: 1 };
  }
  if (BOT_UA.test(userAgent)) {
    return { trafficClass: "bot", reason: "crawler_user_agent", confidence: 1 };
  }
  return { trafficClass: "public", reason: "unlabeled_nonbot", confidence: 0.55 };
}

export function isPublicLeadAlertEligible(trafficClass: TrafficClass): boolean {
  return trafficClass === "public";
}

export const ISCOTT_TEST_HELD_STATUS = "test_held";

export function canDispatchIScottLeadNotification(args: {
  trafficClass?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  operatorQa?: boolean | null;
}): boolean {
  // G 2026-08-19: owner sessions used to be held, so he could never reach the end
  // of his own flow and never saw a real checkmark. The destination is his own
  // inbox either way, so a genuine send costs nothing and makes the tick true.
  // operatorQa no longer blocks delivery for owner - it is still recorded on the
  // lead so a QA row stays identifiable. Automated "test" traffic stays blocked:
  // headless browsers must never email anyone.
  const ownerLead = args.trafficClass === "owner";
  if (args.operatorQa && !ownerLead) return false;
  const resolved = resolveTrafficClassification({
    anonymousVisitorId: args.visitorId || args.sessionId || null,
    explicitLabel:
      args.trafficClass === "owner" ||
      args.trafficClass === "test" ||
      args.trafficClass === "public" ||
      args.trafficClass === "bot"
        ? { trafficClass: args.trafficClass, reason: "lead_row", confidence: 1 }
        : null,
  });
  return isPublicLeadAlertEligible(resolved.trafficClass) || resolved.trafficClass === "owner";
}

export function canDispatchFirstPublicMessageAlert(args: {
  classification: TrafficClassification;
  visitorId?: string | null;
  sessionId?: string | null;
  operatorQa?: boolean | null;
}): boolean {
  if (args.classification.reason === "unlabeled_nonbot") return false;
  // Deliberately public-only. Owner leads now send email, but G should not get a
  // "first public message" page for talking to his own site.
  if (args.classification.trafficClass !== "public") return false;
  return canDispatchIScottLeadNotification({
    trafficClass: args.classification.trafficClass,
    visitorId: args.visitorId,
    sessionId: args.sessionId,
    operatorQa: args.operatorQa,
  });
}
