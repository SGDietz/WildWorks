import twilio from "twilio";

export interface SignatureCheck {
  canonicalUrl: string;
  requestUrl: string;
  signature: string | undefined;
  authToken: string;
}

export function verifyTwilioSignature(check: SignatureCheck): boolean {
  if (!check.signature || check.requestUrl !== check.canonicalUrl) return false;
  return twilio.validateRequest(
    check.authToken,
    check.signature,
    check.canonicalUrl,
    {},
  );
}

export function canonicalRequestUrl(requestTarget: string, configuredUrl: string): string {
  const configured = new URL(configuredUrl);
  return new URL(requestTarget, configured.origin).toString();
}
