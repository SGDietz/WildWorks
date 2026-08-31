/**
 * Staged LiveAvatar FULL-mode truth guard.
 *
 * LiveAvatar only interpolates a dynamic variable when the stored provider
 * context contains the matching placeholder. The active provider context does
 * not contain this placeholder yet, so supplying this variable is deliberately
 * inert until a separately authorized provider-context change installs it.
 *
 * The provider has no authenticated, changing lead-delivery state during the
 * session. Therefore the safe policy is stricter than the local lead-card UI:
 * provider speech must never narrate handoff progress or completion. The local
 * lead card remains the only visitor-facing delivery-truth channel.
 */
export const ISCOTT_HANDOFF_TRUTH_DYNAMIC_VARIABLE = "wildworks_handoff_truth_policy";
export const ISCOTT_HANDOFF_TRUTH_CONTEXT_PLACEHOLDER =
  "${wildworks_handoff_truth_policy}";

export const ISCOTT_HANDOFF_TRUTH_POLICY = [
  "Authenticated server delivery truth is not available to your speech in this session.",
  "Never say or imply that you are sending, preparing to send, or have sent a visitor's details.",
  "Never say or imply that Scott has the details, that delivery succeeded, or that Scott will contact, reach out, review, or follow up.",
  "Do not narrate a queued, delivered, or completed handoff.",
  "The on-screen WildWorks lead card is the only authority for saved, queued, failed, or delivered status.",
  "If asked whether Scott has the details, tell the visitor to use the status shown on that card.",
].join(" ");

export function iscottHandoffTruthDynamicVariables(): Record<string, string> {
  return {
    [ISCOTT_HANDOFF_TRUTH_DYNAMIC_VARIABLE]: ISCOTT_HANDOFF_TRUTH_POLICY,
  };
}

/**
 * The established parser detects completed delivery and future follow-up
 * claims. This narrow companion covers the progressive phrase heard in the
 * failed ride: "I'm sending ... now." Keep it separate so this staged lane
 * does not collide with the active intent/parser hardening work.
 */
export function iscottSpeechClaimsSendingNow(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /\b(?:i(?:'|’)?m|i am|we(?:'|’)?re|we are) sending\b[\s\S]{0,100}\b(?:scott|wildworks|your details|the details|information)\b/i
    .test(normalized);
}
