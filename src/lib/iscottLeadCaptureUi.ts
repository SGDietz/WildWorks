export type LeadCaptureUi = "hidden" | "listening" | "captured" | "pending" | "sent" | "failed";

export function visitorChoseContactMethod(text: string): "email" | "phone" | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/\b(?:email|e-mail|phone|call|telephone)\s+or\s+(?:email|e-mail|phone|call|telephone)\b/i.test(normalized)) {
    return null;
  }
  // G 2026-08-19: this used to reject ANY line containing "reach out", which
  // swallowed the visitor's own answer - "I would like for Scott to reach out by
  // email" - so the capture box never opened. Reject only a line actually SHAPED
  // like the question; a line offering both methods is already rejected above.
  // KEEP IN SYNC with its twin - check-iscott-method-choice.mjs fails on drift.
  if (/\?\s*$/.test(normalized)
    && /\b(?:how should|how would|would you like|should scott|which do you prefer|best way)\b/i.test(normalized)) {
    return null;
  }
  if (/\b(?:or\s+text|text\s+me|by\s+text|via\s+sms|sms|phone|call|telephone)\b/i.test(normalized)
    && !/\b(?:e-?mail)\b/i.test(normalized)) {
    return "phone";
  }
  if (/\bas soon as i\b|\bemail box\b|\bstupid\b.{0,40}\bbox\b/i.test(normalized)) {
    return null;
  }
  if (/\b(?:e-?mail(?:'s| is)?\s+fine|prefer\s+(?:an?\s+)?e-?mail|by\s+e-?mail|use\s+e-?mail|e-?mail)\b/i.test(normalized)) {
    return "email";
  }
  return null;
}

export function methodChoiceFromUtterance(args: {
  role: string;
  text: string;
}): "email" | "phone" | null {
  if (args.role !== "user") return null;
  return visitorChoseContactMethod(args.text);
}

export function nextLeadCaptureUi(args: {
  speakerRole: "user" | "assistant";
  visitorMethod: "email" | "phone" | null;
  hasValidCandidate: boolean;
  confirmedAction?: boolean;
  sendInFlight?: boolean;
  notificationStatus?: string | null;
  delivered?: boolean | null;
}): LeadCaptureUi {
  if (args.notificationStatus === "failed" || args.notificationStatus === "dead_letter") return "failed";
  if (args.notificationStatus === "test_held") {
    return args.hasValidCandidate ? "captured" : args.visitorMethod ? "listening" : "hidden";
  }
  if (args.delivered === true && args.notificationStatus === "sent") return "sent";
  if (args.confirmedAction || args.sendInFlight || args.notificationStatus === "queued") return "pending";
  if (args.hasValidCandidate) return "captured";
  if (args.visitorMethod && args.speakerRole !== "assistant") return "listening";
  return "hidden";
}

export function listeningCopy(method: "email" | "phone"): { label: string; placeholder: string; sendEnabled: false } {
  return method === "phone"
    ? { label: "Phone Selected", placeholder: "type or say your phone number", sendEnabled: false }
    : { label: "Email Selected", placeholder: "type or spell your email", sendEnabled: false };
}
