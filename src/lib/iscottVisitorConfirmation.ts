import { createHash } from "node:crypto";
import {
  evaluateLeadPackageChronology,
  isMeaningfulVisitorName,
  isSpecificProjectNeed,
  normalizedContactValue,
  normalizedPackageIntent,
  normalizedPackageName,
} from "./iscottLeadParsing";

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
};

export type IScottVisitorConfirmationArgs = {
  sessionId: string;
  ownerNotificationOutboxId: string;
  // The address the owner package was actually addressed from. It must match
  // the stored one; a request to receipt some other mailbox is refused.
  sentEmail?: string | null;
  lead: IScottVisitorConfirmationLeadReread;
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

// PRIVACY-MINIMAL COPY. The visitor already knows what they said; repeating it
// back to an address that could be mistyped, shared, or forwarded is how a
// receipt becomes a leak. No transcript, no contact value, no free-form project
// text, no media or internal links, no timing, no booking, no outcome, and no
// price. Frozen as data so a test can compare the whole body word for word.
export const ISCOTT_VISITOR_CONFIRMATION_SUBJECT = "WildWorks received your request";
export const ISCOTT_VISITOR_CONFIRMATION_LINES: readonly string[] = [
  "WildWorks received your request.",
  "This note confirms that your request was submitted.",
  "No reply is needed.",
];

function visitorConfirmationText(): string {
  return ISCOTT_VISITOR_CONFIRMATION_LINES.join("\n\n");
}

function visitorConfirmationHtml(): string {
  // Built from the same frozen lines, so the two bodies cannot drift apart and
  // let something into the HTML that the text review never saw.
  const [heading, ...rest] = ISCOTT_VISITOR_CONFIRMATION_LINES;
  return [
    `<h1>${heading}</h1>`,
    ...rest.map((line) => `<p>${line}</p>`),
  ].join("");
}

function cleanedText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
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
  email?: string | null;
  submittedAt?: string | null;
  contactConfirmedAt?: string | null;
}): string {
  const canonical = JSON.stringify([
    "iscott_visitor_confirmation/v1",
    cleanedText(args.sessionId),
    normalizedPackageName(args.fullName) ?? "",
    normalizedPackageIntent(args.projectNeed) ?? "",
    "email",
    normalizedContactValue("email", args.email) ?? "",
    cleanedText(args.submittedAt),
    cleanedText(args.contactConfirmedAt),
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
  args: IScottVisitorConfirmationArgs,
): { blockers: IScottVisitorConfirmationBlocker[]; recipient: string | null } {
  const blockers: IScottVisitorConfirmationBlocker[] = [];
  const lead = args.lead ?? {};
  if (!cleanedText(args.sessionId)) blockers.push("missing_session");
  if (!cleanedText(args.ownerNotificationOutboxId)) blockers.push("missing_owner_notification");

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
  if (!isSpecificProjectNeed(lead.projectNeed)) blockers.push("generic_project_need");
  if (lead.consentStatus !== "accepted") blockers.push("consent_not_accepted");
  if (!cleanedText(lead.contactConfirmedAt)) blockers.push("contact_not_confirmed");

  // A receipt is an email-only object. A phone lead has no mailbox that the
  // visitor confirmed, and inventing one from anywhere else is exactly the
  // failure this whole gate exists to prevent.
  if (lead.contactMethod !== "email") blockers.push("contact_method_not_email");

  const storedEmail = normalizedContactValue("email", lead.email ?? null);
  const recipient = storedEmail && EMAIL_PATTERN.test(storedEmail) ? storedEmail : null;
  if (!recipient) blockers.push("missing_stored_email");
  else if (args.sentEmail !== undefined && args.sentEmail !== null) {
    const sent = normalizedContactValue("email", args.sentEmail);
    if (sent !== recipient) blockers.push("sent_contact_mismatch");
  }

  // The same transcript walk the owner send had to pass, asked again about the
  // package as it stands now. Permission for a package the visitor has since
  // changed is not permission for this one.
  if (recipient) {
    const chronology = evaluateLeadPackageChronology({
      rows: args.proofRows ?? [],
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
  args: IScottVisitorConfirmationArgs,
): IScottVisitorConfirmationDecision {
  const { blockers, recipient } = evaluateIScottVisitorConfirmationEligibility(args);
  const sessionId = cleanedText(args.sessionId);
  const packageVersionHash = recipient && sessionId
    ? iscottVisitorConfirmationPackageVersionHash({
        sessionId,
        fullName: args.lead?.fullName ?? null,
        projectNeed: args.lead?.projectNeed ?? null,
        email: args.lead?.email ?? null,
        submittedAt: args.lead?.submittedAt ?? null,
        contactConfirmedAt: args.lead?.contactConfirmedAt ?? null,
      })
    : null;
  if (blockers.length || !recipient || !packageVersionHash) {
    return { eligible: false, blockers, prepared: null, packageVersionHash, recipient };
  }
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
      text: visitorConfirmationText(),
      html: visitorConfirmationHtml(),
    },
  };
}
