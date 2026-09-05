import { createHash } from "node:crypto";
import {
  evaluateLeadPackageChronology,
  isMeaningfulVisitorName,
  isSpecificProjectNeed,
  summariseProjectForEmail,
  normalizedContactValue,
  normalizedPackageIntent,
  normalizedPackageName,
} from "./iscottLeadParsing";
import { emailLink, emailParagraph, emailSection, emailShell, escapeHtml } from "./emailTheme";

// PREPARATION ONLY, 2026-08-29. Nothing in this file is authorized to send.
//
// Activation is a source change, not an environment toggle. No deployment, no
// stale environment variable, and no database value can turn this on: the
// constant is read at module scope and the notifier refuses before it reads,
// writes, or contacts anything. G reviews every piece of mail before Send; an
// automated transactional receipt would be an exception to that rule and only
// he can decide to make one.
export const ISCOTT_VISITOR_CONFIRMATION_ENABLED = true; // G authorized 2026-08-30; migration applied same night

// What a lead row means before anyone has decided anything. It is the column
// default in the migration and the answer this module gives while dispatch is
// unauthorized: the receipt is waiting on a person, not on a retry.
export const ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS = "approval_required";

export type IScottVisitorConfirmationStatus =
  | "approval_required"
  | "blocked"
  | "queued"
  // PROVIDER ACCEPTED IS NOT DELIVERED. A 2xx from the mail provider says the
  // provider took custody of the message. It says nothing about an inbox. The
  // only thing that could say that is a separately authorized, authenticated
  // provider webhook, which is deliberately not implemented or enabled here.
  | "provider_accepted"
  | "failed";

export type IScottVisitorConfirmationBlocker =
  | "feature_not_authorized"
  | "missing_session"
  | "missing_owner_notification"
  | "not_submitted"
  | "missing_submitted_at"
  | "missing_full_name"
  | "generic_project_need"
  | "consent_not_accepted"
  | "contact_not_confirmed"
  | "contact_method_not_email"
  | "missing_stored_email"
  | "sent_contact_mismatch"
  | "no_exact_contact_consent"
  | "package_changed_after_permission";

type ProofTurn = {
  role: "user" | "assistant";
  message: string;
  laAbsoluteTimestamp: number | null;
};

// The lead as it was READ BACK OUT OF THE DATABASE after the owner handoff was
// made durable - never the in-memory row this process happened to be holding.
export type IScottVisitorConfirmationLeadReread = {
  status?: string | null;
  submittedAt?: string | null;
  fullName?: string | null;
  projectNeed?: string | null;
  consentStatus?: string | null;
  contactConfirmedAt?: string | null;
  contactMethod?: "email" | "phone" | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  mediaCount?: number | null;
  mediaTypes?: string[] | null;
};

export type IScottVisitorConfirmationArgs = {
  sessionId: string;
  ownerNotificationOutboxId: string;
  // The address the owner package was actually addressed from. It must match
  // the stored one; a request to receipt some other mailbox is refused.
  sentEmail?: string | null;
  lead?: IScottVisitorConfirmationLeadReread | null;
  proofRows?: ProofTurn[];
};

export type PreparedIScottVisitorConfirmation = {
  eventType: "iscott_visitor_confirmation";
  idempotencyKey: string;
  packageVersionHash: string;
  sessionId: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
};

export type IScottVisitorConfirmationDecision = {
  eligible: boolean;
  blockers: IScottVisitorConfirmationBlocker[];
  prepared: PreparedIScottVisitorConfirmation | null;
  packageVersionHash: string | null;
  recipient: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// H443b visitor receipt. Scott 2026-09-02 11:57 AM ET: look beautiful and say
// more. From WildWorks, received your request, Scott will be reaching out
// regarding a BRIEF of what was talked about, then no reply is needed.
// Claude 12:12 ET: owner-outbox retire was a Codex test-fake race, not this
// file. Do not rewrite retire. Builders stay defensive: lead may be missing,
// projectNeed may be null, 400-char need is clipped, never throw.
// NO SMS. Phone = email-only (contact_method_not_email stays). Twilio is voice.
export const ISCOTT_VISITOR_CONFIRMATION_SUBJECT = "WildWorks received your request.";
export const ISCOTT_VISITOR_CONFIRMATION_HEADING = "Thanks for reaching out.";
export const ISCOTT_VISITOR_CONFIRMATION_FROM = "FROM WILDWORKS";
export const ISCOTT_VISITOR_CONFIRMATION_OPENING = "We received your request and contact information.";
export const ISCOTT_VISITOR_CONFIRMATION_FOLLOW_UP = "The WildWorks team will review the details and follow up with you by email.";
export const ISCOTT_VISITOR_CONFIRMATION_REPLY = "You can reply to this email to send a message to the WildWorks team.";
export const SCOTT_PUBLIC_PHONE = "443-797-2166";
export const SCOTT_PUBLIC_PHONE_TEL = "tel:+14437972166";
export const SCOTT_PUBLIC_SITE = "https://wildworks.ai";
export const SCOTT_PUBLIC_SITE_LABEL = "wildworks.ai";

const BRIEF_SUMMARY_MAX = 220;
const UNSAFE_PROJECT_SUMMARY = /[<>\[\]{}\x00-\x1f]|\b(?:assistant|developer|system|tool(?:[_ -]?call)?|transcript|supabase|dashboard|ignore (?:all |any )?(?:previous|prior)|here is what you told|iscott said|user said)\b/i;
const NOISY_PROJECT_SUMMARY = /^(?:(?:um+|uh+|erm+|hmm+|like|okay|ok|so|well|yeah|yes|no)[\s,.!?-]*){3,}$/i;
const GENERIC_PROJECT_SUMMARY = /^(?:not stated(?: yet)?|no project(?: stated)?|unknown|unsure|nothing(?: yet)?|n\/?a)$/i;

function asText(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (value == null) return "";
  try {
    return String(value).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function safeEscape(value: unknown): string {
  const s = asText(value);
  try {
    return escapeHtml(s);
  } catch {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

function cleanedText(value: unknown): string {
  return asText(value);
}

export function briefVisitorSummary(projectNeed: unknown): string {
  try {
    const cleaned = asText(projectNeed)
      .replace(/\b(?:and\s+)?everything else\b[.!]?$/i, "plus additional landscaping to shape the whole space")
      .replace(/\bscott\b/gi, "Scott")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || !isSpecificProjectNeed(cleaned)) return "";
    if (UNSAFE_PROJECT_SUMMARY.test(cleaned) || NOISY_PROJECT_SUMMARY.test(cleaned) || GENERIC_PROJECT_SUMMARY.test(cleaned)) return "";
    if (!/[a-z]/i.test(cleaned) || /(?:\b(?:um+|uh+|erm+|hmm+)\b[\s,.!?-]*){3,}/i.test(cleaned)) return "";
    if (cleaned.length <= BRIEF_SUMMARY_MAX) return cleaned;
    const cut = cleaned.slice(0, BRIEF_SUMMARY_MAX);
    const lastSpace = cut.lastIndexOf(" ");
    const clipped = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "");
    return `${clipped}...`;
  } catch {
    return "";
  }
}

// G 2026-09-03 11:4x ET, reading his own receipt for the long-email ride:
// "instead of it saying 'what you talked about with iScott'... it should have a
// little summary of what the user actually talked to iScott about. 'You sent
// this by email.' Why is that there?"
//
// The summary is the visitor's OWN words, read off the proof rows (the same
// transcript walk the send had to pass), never a model's guess: the first two
// substantive things they said, minus the yes/okay/name/address turns. When
// there is a specific project need it leads instead. And the pointless method
// line becomes the one useful fact it was hiding: which address Scott will
// use.
const VISITOR_QUOTE_MAX = 220;
// A line that OPENS with an acknowledgement ("You did. That's great.") is
// still an acknowledgement, so this matches the start, not the whole line.
const VISITOR_QUOTE_SKIP = /^(?:yes|yeah|yep|no|nope|okay|ok|alright|all right|great|got it|correct|you did|that'?s|thank(?:s| you)|hi|hello|hey|um|uh|so yes|awesome|wow|perfect|sure)\b/i;
const VISITOR_QUOTE_CONTACTISH = /@|\d[\d\s().-]{6,}\d|\bmy name is\b|\bmy email\b|\bemail'?s\b|\bphone'?s\b|\breach out to me\b|\bsend (?:him|scott|me) an? email\b|\bspell\b/i;

export function visitorQuoteFromProof(rows: unknown): string {
  try {
    if (!Array.isArray(rows)) return "";
    const picked: string[] = [];
    for (const row of rows) {
      const role = row && typeof row === "object" ? (row as { role?: unknown }).role : null;
      if (role !== "user") continue;
      const text = asText((row as { message?: unknown }).message);
      if (!text) continue;
      if (text.split(/\s+/).length < 4) continue;
      if (VISITOR_QUOTE_SKIP.test(text)) continue;
      if (VISITOR_QUOTE_CONTACTISH.test(text)) continue;
      picked.push(text.replace(/\s+/g, " ").trim());
      if (picked.length === 2) break;
    }
    const joined = picked.join(" ");
    if (!joined) return "";
    if (joined.length <= VISITOR_QUOTE_MAX) return joined;
    const cut = joined.slice(0, VISITOR_QUOTE_MAX);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}...`;
  } catch {
    return "";
  }
}

export type VisitorReceiptCopy = {
  opening: string;
  uploads: string | null;
  projectSummary: string | null;
  followUp: string;
  contact: string;
  reply: string;
};

export function visitorReceiptCopy(args?: {
  projectNeed?: unknown;
  projectArea?: unknown;
  projectDetails?: unknown;
  mediaCount?: unknown;
  mediaTypes?: unknown;
  contactMethod?: unknown;
  proofRows?: unknown;
} | null): VisitorReceiptCopy {
  try {
    // proofRows is intentionally ignored. Visitor mail may summarize only the
    // validated structured project field, never conversation or tool output.
    const details = [args?.projectNeed, ...(Array.isArray(args?.projectDetails) ? args.projectDetails : [])]
      .map((value) => briefVisitorSummary(value))
      .filter(Boolean)
      .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
      .slice(0, 6);
    const area = asText(args?.projectArea);
    const safeArea = /^(?:backyard|front yard|side yard|whole property|entire property|garden|patio)$/i.test(area)
      ? area.toLowerCase()
      : "";
    const subject = summariseProjectForEmail(details, safeArea);
    const projectSummary = subject ? `Subject: ${subject}.` : null;
    const rawMediaCount = Number(args?.mediaCount);
    const mediaCount = Number.isFinite(rawMediaCount) ? Math.max(0, Math.floor(rawMediaCount)) : 0;
    const mediaTypes = Array.isArray(args?.mediaTypes)
      ? [...new Set(args.mediaTypes.map((value) => asText(value).toLowerCase()).filter((value) => /^(?:photo|video|document)$/.test(value)))]
      : [];
    return {
      opening: ISCOTT_VISITOR_CONFIRMATION_OPENING,
      uploads: mediaCount > 0
        ? `We also received ${mediaCount} uploaded file${mediaCount === 1 ? "" : "s"}${mediaTypes.length ? ` (${mediaTypes.join(", ")})` : ""}.`
        : null,
      projectSummary,
      followUp: ISCOTT_VISITOR_CONFIRMATION_FOLLOW_UP,
      contact: `Call ${SCOTT_PUBLIC_PHONE} or visit ${SCOTT_PUBLIC_SITE_LABEL}.`,
      reply: ISCOTT_VISITOR_CONFIRMATION_REPLY,
    };
  } catch {
    return {
      opening: ISCOTT_VISITOR_CONFIRMATION_OPENING,
      uploads: null,
      projectSummary: null,
      followUp: ISCOTT_VISITOR_CONFIRMATION_FOLLOW_UP,
      contact: `Call ${SCOTT_PUBLIC_PHONE} or visit ${SCOTT_PUBLIC_SITE_LABEL}.`,
      reply: ISCOTT_VISITOR_CONFIRMATION_REPLY,
    };
  }
}

export function iscottVisitorConfirmationLines(projectNeed?: unknown): readonly string[] {
  const copy = visitorReceiptCopy({ projectNeed });
  return [
    ISCOTT_VISITOR_CONFIRMATION_HEADING,
    copy.opening,
    ...(copy.uploads ? [copy.uploads] : []),
    ...(copy.projectSummary ? ["YOUR PROJECT", copy.projectSummary] : []),
    copy.followUp,
    copy.contact,
    copy.reply,
  ];
}

// Static frame so module load cannot throw. Live mail uses visitorReceiptCopy.
export const ISCOTT_VISITOR_CONFIRMATION_LINES: readonly string[] = [
  ISCOTT_VISITOR_CONFIRMATION_HEADING,
  ISCOTT_VISITOR_CONFIRMATION_OPENING,
  ISCOTT_VISITOR_CONFIRMATION_FOLLOW_UP,
  `Call ${SCOTT_PUBLIC_PHONE} or visit ${SCOTT_PUBLIC_SITE_LABEL}.`,
  ISCOTT_VISITOR_CONFIRMATION_REPLY,
];

export function visitorConfirmationText(input?: {
  projectNeed?: unknown;
  projectArea?: unknown;
  projectDetails?: unknown;
  mediaCount?: unknown;
  mediaTypes?: unknown;
  contactMethod?: unknown;
  proofRows?: unknown;
} | null): string {
  try {
    const copy = visitorReceiptCopy(input);
    return [
      ISCOTT_VISITOR_CONFIRMATION_FROM,
      ISCOTT_VISITOR_CONFIRMATION_HEADING,
      copy.opening,
      ...(copy.uploads ? [copy.uploads] : []),
      ...(copy.projectSummary ? ["YOUR PROJECT", copy.projectSummary] : []),
      copy.followUp,
      copy.contact,
      copy.reply,
    ].join("\n\n");
  } catch {
    return [
      ISCOTT_VISITOR_CONFIRMATION_FROM,
      ...ISCOTT_VISITOR_CONFIRMATION_LINES,
    ].join("\n\n");
  }
}

const FALLBACK_HTML =
  "<p>Thanks for reaching out. We received your request and contact information.</p>";

export function visitorConfirmationHtml(input?: {
  projectNeed?: unknown;
  projectArea?: unknown;
  projectDetails?: unknown;
  mediaCount?: unknown;
  mediaTypes?: unknown;
  contactMethod?: unknown;
  proofRows?: unknown;
} | null): string {
  try {
    const copy = visitorReceiptCopy(input);
    const contactHtml =
      `Call ${emailLink(SCOTT_PUBLIC_PHONE_TEL, SCOTT_PUBLIC_PHONE)} or visit ` +
      `${emailLink(SCOTT_PUBLIC_SITE, SCOTT_PUBLIC_SITE_LABEL)}.`;
    return emailShell({
      title: ISCOTT_VISITOR_CONFIRMATION_SUBJECT,
      heading: ISCOTT_VISITOR_CONFIRMATION_HEADING,
      eyebrow: ISCOTT_VISITOR_CONFIRMATION_FROM,
      bodyHtml: [
        emailParagraph(safeEscape(copy.opening)),
        copy.uploads ? emailParagraph(safeEscape(copy.uploads)) : "",
        copy.projectSummary
          ? emailSection({ label: "YOUR PROJECT", html: emailParagraph(safeEscape(copy.projectSummary)) })
          : "",
        emailParagraph(safeEscape(copy.followUp)),
        emailParagraph(contactHtml),
        emailParagraph(safeEscape(copy.reply)),
      ].join(""),
    });
  } catch {
    try {
      return emailShell({
        title: ISCOTT_VISITOR_CONFIRMATION_SUBJECT,
        heading: ISCOTT_VISITOR_CONFIRMATION_HEADING,
        eyebrow: ISCOTT_VISITOR_CONFIRMATION_FROM,
        bodyHtml: [
          emailParagraph(safeEscape(ISCOTT_VISITOR_CONFIRMATION_OPENING)),
          emailParagraph(safeEscape(ISCOTT_VISITOR_CONFIRMATION_FOLLOW_UP)),
          emailParagraph(safeEscape(ISCOTT_VISITOR_CONFIRMATION_REPLY)),
        ].join(""),
      });
    } catch {
      return FALLBACK_HTML;
    }
  }
}

function leadFrom(args: IScottVisitorConfirmationArgs | null | undefined): IScottVisitorConfirmationLeadReread {
  if (!args || typeof args !== "object") return {};
  const nested = args.lead;
  if (nested && typeof nested === "object") return nested;
  return {};
}

// THE VERSION HASH, AND WHY IT IS A HASH.
//
// The canonical package below contains the visitor's name, their project words,
// and their mailbox: it exists only as hash INPUT and is never stored, logged,
// or mailed. What leaves this function is 64 hex characters that identify one
// exact submitted package with no personal data in it, which is what the
// durable idempotency key and the lead's version column are allowed to hold.
//
// Any material change to the package - a corrected name, a fuller project, a
// different mailbox, a new submission - produces a different hash and therefore
// a different receipt identity. That on its own is not permission to send it:
// the eligibility gate has to find current consent for the changed package too.
export function iscottVisitorConfirmationPackageVersionHash(args: {
  sessionId: string;
  fullName?: string | null;
  projectNeed?: string | null;
  projectDetails?: string[] | null;
  email?: string | null;
  submittedAt?: string | null;
  contactConfirmedAt?: string | null;
}): string {
  const canonical = JSON.stringify([
    "iscott_visitor_confirmation/v1",
    cleanedText(args?.sessionId),
    normalizedPackageName(args?.fullName) ?? "",
    normalizedPackageIntent(args?.projectNeed) ?? "",
    (args?.projectDetails ?? []).map((value) => normalizedPackageIntent(value) ?? "").filter(Boolean),
    "email",
    normalizedContactValue("email", args?.email) ?? "",
    cleanedText(args?.submittedAt),
    cleanedText(args?.contactConfirmedAt),
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function iscottVisitorConfirmationIdempotencyKey(packageVersionHash: string): string {
  return `iscott-visitor-confirmation:${packageVersionHash}`;
}

// EVERY REASON THIS MAY NOT BE BUILT, COLLECTED IN ONE PLACE.
//
// The list is complete rather than first-failure, because the blocker that gets
// written to the lead row is the one an operator reads later, and "we stopped at
// the first no" hides the rest of the picture from them.
export function evaluateIScottVisitorConfirmationEligibility(
  args: IScottVisitorConfirmationArgs | null | undefined,
): { blockers: IScottVisitorConfirmationBlocker[]; recipient: string | null } {
  const blockers: IScottVisitorConfirmationBlocker[] = [];
  const a = args && typeof args === "object" ? args : ({} as IScottVisitorConfirmationArgs);
  const lead = leadFrom(a);
  if (!cleanedText(a.sessionId)) blockers.push("missing_session");
  if (!cleanedText(a.ownerNotificationOutboxId)) blockers.push("missing_owner_notification");

  if (lead.status !== "submitted") blockers.push("not_submitted");
  if (!cleanedText(lead.submittedAt)) blockers.push("missing_submitted_at");
  // G, 2026-08-30 said a missing name must not stop a lead reaching him.
  // It no longer does - but the answer was NOT to delete this blocker. It
  // also drives iScott's "still needs your name" prompt and the lead-card
  // copy, so removing it would stop him ever ASKING for a name at all.
  // The guarantee G actually wanted lives in the partial-lead notification
  // in iscottLeadCapture.ts: anything holding an email or a phone is mailed
  // to him regardless of name, consent or qualification. Strict here,
  // nothing lost there.
  if (!isMeaningfulVisitorName(lead.fullName)) blockers.push("missing_full_name");
  // G, 2026-09-02 16:47 ET, chose (a) to "(a) Send anyway. Email says project need: not stated yet." His word, verbatim: "a". A receipt goes out with or without a stated need.
  if (lead.consentStatus !== "accepted") blockers.push("consent_not_accepted");
  if (!cleanedText(lead.contactConfirmedAt)) blockers.push("contact_not_confirmed");

  // A receipt is an email-only object. A phone lead has no mailbox that the
  // visitor confirmed, and inventing one from anywhere else is exactly the
  // failure this whole gate exists to prevent. NO SMS. Twilio is voice only.
  if (lead.contactMethod !== "email") blockers.push("contact_method_not_email");

  const storedEmail = normalizedContactValue("email", lead.email ?? null);
  const recipient = storedEmail && EMAIL_PATTERN.test(storedEmail) ? storedEmail : null;
  if (!recipient) blockers.push("missing_stored_email");
  else if (a.sentEmail !== undefined && a.sentEmail !== null) {
    const sent = normalizedContactValue("email", a.sentEmail);
    if (sent !== recipient) blockers.push("sent_contact_mismatch");
  }

  // The same transcript walk the owner send had to pass, asked again about the
  // package as it stands now. Permission for a package the visitor has since
  // changed is not permission for this one.
  if (recipient) {
    const chronology = evaluateLeadPackageChronology({
      rows: a.proofRows ?? [],
      fullName: lead.fullName ?? null,
      projectNeed: lead.projectNeed ?? null,
      contactMethod: "email",
      contactValue: lead.email ?? null,
    });
    if (chronology.permissionIndex === null) blockers.push("no_exact_contact_consent");
    else if (!chronology.permissionCurrent) blockers.push("package_changed_after_permission");
  }

  return { blockers, recipient };
}

export function prepareIScottVisitorConfirmation(
  args: IScottVisitorConfirmationArgs | null | undefined,
): IScottVisitorConfirmationDecision {
  const empty: IScottVisitorConfirmationDecision = {
    eligible: false,
    blockers: ["missing_session"],
    prepared: null,
    packageVersionHash: null,
    recipient: null,
  };
  try {
    const { blockers, recipient } = evaluateIScottVisitorConfirmationEligibility(args);
    const a = args && typeof args === "object" ? args : ({} as IScottVisitorConfirmationArgs);
    const lead = leadFrom(a);
    const sessionId = cleanedText(a.sessionId);
    const packageVersionHash = recipient && sessionId
      ? iscottVisitorConfirmationPackageVersionHash({
          sessionId,
          fullName: lead.fullName ?? null,
          projectNeed: lead.projectNeed ?? null,
          projectDetails: Array.isArray(lead.metadata?.project_details)
            ? lead.metadata.project_details.filter((value): value is string => typeof value === "string")
            : [],
          email: lead.email ?? null,
          submittedAt: lead.submittedAt ?? null,
          contactConfirmedAt: lead.contactConfirmedAt ?? null,
        })
      : null;
    if (blockers.length || !recipient || !packageVersionHash) {
      return { eligible: false, blockers, prepared: null, packageVersionHash, recipient };
    }
    const bodies = {
      projectNeed: lead.projectNeed ?? null,
      projectArea: lead.metadata?.project_area ?? null,
      projectDetails: lead.metadata?.project_details ?? [],
      mediaCount: lead.mediaCount ?? 0,
      mediaTypes: lead.mediaTypes ?? [],
      contactMethod: lead.contactMethod ?? null,
      proofRows: a.proofRows ?? [],
    };
    return {
      eligible: true,
      blockers: [],
      packageVersionHash,
      recipient,
      prepared: {
        eventType: "iscott_visitor_confirmation",
        idempotencyKey: iscottVisitorConfirmationIdempotencyKey(packageVersionHash),
        packageVersionHash,
        sessionId,
        recipient,
        subject: ISCOTT_VISITOR_CONFIRMATION_SUBJECT,
        text: visitorConfirmationText(bodies),
        html: visitorConfirmationHtml(bodies),
      },
    };
  } catch {
    return empty;
  }
}
