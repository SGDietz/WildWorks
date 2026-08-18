export type TrafficClass = "owner" | "test" | "public" | "bot";

export type TrafficClassification = {
  trafficClass: TrafficClass;
  reason: string;
  confidence: number;
};

const TEST_UA = /(HeadlessChrome|Playwright|Puppeteer|jsdom|Lighthouse)/i;
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
}): TrafficClassification {
  const anonymousVisitorId = clean(args.anonymousVisitorId, 160);
  if (anonymousVisitorId?.startsWith("codex-") || anonymousVisitorId?.startsWith("ww-test-")) {
    return { trafficClass: "test", reason: "codex_test_identifier", confidence: 1 };
  }
  if (anonymousVisitorId?.startsWith("ww-owner-")) {
    return { trafficClass: "owner", reason: "owner_test_identifier", confidence: 1 };
  }
  if (args.explicitLabel) return args.explicitLabel;
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
  if (args.operatorQa) return false;
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
  return isPublicLeadAlertEligible(resolved.trafficClass);
}

export function canDispatchFirstPublicMessageAlert(args: {
  classification: TrafficClassification;
  visitorId?: string | null;
  sessionId?: string | null;
  operatorQa?: boolean | null;
}): boolean {
  if (args.classification.reason === "unlabeled_nonbot") return false;
  return canDispatchIScottLeadNotification({
    trafficClass: args.classification.trafficClass,
    visitorId: args.visitorId,
    sessionId: args.sessionId,
    operatorQa: args.operatorQa,
  });
}
