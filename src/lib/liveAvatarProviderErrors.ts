export type LiveAvatarFailureClass =
  | "account_credit_exhausted"
  | "authentication_rejected"
  | "rate_limited"
  | "provider_rejected_request"
  | "provider_unavailable";

type ProviderErrorFields = {
  providerCode: string | number | null;
  providerMessage: string | null;
};

const cleanField = (value: unknown, limit: number): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return cleaned ? cleaned.slice(0, limit) : null;
};

export const readLiveAvatarProviderError = (body: string): ProviderErrorFields => {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const data = parsed?.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
      ? parsed.data as Record<string, unknown>
      : null;
    const firstDataError = Array.isArray(parsed?.data) && parsed.data[0] && typeof parsed.data[0] === "object"
      ? parsed.data[0] as Record<string, unknown>
      : null;
    const rawCode = parsed?.code ?? data?.code ?? null;
    return {
      providerCode: typeof rawCode === "number" || typeof rawCode === "string"
        ? (typeof rawCode === "string" ? rawCode.slice(0, 80) : rawCode)
        : null,
      // Prefer the specific bounded validation message over a generic envelope
      // such as "Errors validating session token". Never retain loc/params or
      // any raw response body.
      providerMessage: cleanField(firstDataError?.message ?? parsed?.message ?? data?.message, 240),
    };
  } catch {
    return { providerCode: null, providerMessage: null };
  }
};

export const classifyLiveAvatarProviderError = (
  status: number,
  fields: ProviderErrorFields,
): LiveAvatarFailureClass => {
  const evidence = `${fields.providerCode ?? ""} ${fields.providerMessage ?? ""}`.toLowerCase();
  if (/\b(?:credit|balance|quota)\b/.test(evidence)
    && /\b(?:insufficient|exhausted|depleted|empty|purchase|required|low)\b/.test(evidence)) {
    return "account_credit_exhausted";
  }
  if (status === 401 || status === 403 || /\b(?:unauthorized|authentication|api key)\b/.test(evidence)) {
    return "authentication_rejected";
  }
  if (status === 429 || /\brate limit(?:ed)?\b|too many requests/.test(evidence)) {
    return "rate_limited";
  }
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected_request";
};
