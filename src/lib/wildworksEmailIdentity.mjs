const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DISPLAY_NAME_PATTERN = /^[^<>]*<([^<>]+)>$/;
const WILDWORKS_SENDER_DOMAINS = new Set(["wildworks.ai", "wildworks.live"]);

export function parseWildWorksSenderAddress(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const displayNameMatch = DISPLAY_NAME_PATTERN.exec(trimmed);
  if (!displayNameMatch && /[<>]/.test(trimmed)) return null;
  const address = (displayNameMatch?.[1] ?? trimmed).trim();
  return EMAIL_PATTERN.test(address) ? address : null;
}

/**
 * WildWorks notifications must never inherit an aiASAP or iSolve sender.
 * Both apex WildWorks domains are accepted; subdomains and every other brand
 * fail closed.
 */
export function wildWorksSenderConfigurationError(env = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const address = parseWildWorksSenderAddress(env.RESEND_FROM_EMAIL);
  if (!apiKey || !address) return "resend_not_configured";

  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return WILDWORKS_SENDER_DOMAINS.has(domain)
    ? null
    : "wildworks_sender_domain_mismatch";
}
