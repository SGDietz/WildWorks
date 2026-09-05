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
  // Talking about the visible field is not choosing a contact method. Keep
  // this before the broad phone/email branches: f1163ff3 said "the box ...
  // your phone" while correcting the UI and briefly flipped the live field.
  if (/\b(?:email|phone|capture)\s+box\b|\bbox\b[\s\S]{0,40}\b(?:email|phone)\b|\b(?:email|phone)\b[\s\S]{0,40}\b(?:box|words?|label|glow)\b/i.test(normalized)) {
    return null;
  }
  // A physical-phone complaint is also not a contact-method choice. Keep the
  // phrase narrow so "Phone. My number is on the screen." remains a valid
  // answer; the screen alone is not evidence of UI commentary.
  if (/\b(?:throw(?:ing)?|threw|drop(?:ped|ping)?|broke|broken|lost|where did)\b[\s\S]{0,40}\bphone\b/i.test(normalized)) {
    return null;
  }
  // G's desktop ride 1cc18a84, 2026-09-03 15:46 ET: "Um, can I call you Scott?"
  // opened the YOUR PHONE box two minutes before any contact talk - "I haven't
  // said anything about wanting to do phone number or email" / "take the box
  // down. Because we haven't gotten there yet." Calling SOMEONE something, or
  // asking what to call them, is not asking to be phoned. A bare "call me" is
  // still a phone choice; "call me Scott" is a name.
  if (!/\b(?:phone|telephone|sms|text\s+me|by\s+text|or\s+text)\b/i.test(normalized)
    && (/\b(?:call|calling|called)\s+(?:you|him|her|it|them|this|that|yourself|himself|herself|iscott|scott)\b|\bwhat\s+(?:do|should|can|would)\s+i\s+call\b/i.test(normalized)
      || /\b[Cc]all me [A-Z][a-z]+\b/.test(normalized))) {
    return null;
  }
  // Describing an outgoing notification is not choosing how to be contacted.
  // The restarted 23073d24 ride mentioned a follow-up email about a photo;
  // the broad email match opened an unsolicited empty capture box.
  const personalContactChoice = /\b(?:e-?mail me|contact me|reach me|reach out to me|(?:prefer|by|via|use)\s+e-?mail|my e-?mail (?:is|address))\b/i.test(normalized);
  if (!personalContactChoice && /\bfollow[- ]?up\s+e-?mail\b|\b(?:send|sent|sending|receive[ds]?|saved|upload\w*)\b[\s\S]{0,70}\be-?mail\b|\be-?mail\b[\s\S]{0,70}\b(?:send|sent|sending|saved|lead|notification|receipt|information|upload\w*)\b/i.test(normalized)) {
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
