import { classifyPublicInterest } from "./iscottLeadParsing";

export const ISCOTT_LAUNCH_RECONCILE_ENV = "ISCOTT_LAUNCH_RECONCILE_ENABLED";

export type ReconcileLead = {
  sessionId: string;
  trafficClass?: string | null;
  status?: string | null;
  consentStatus?: string | null;
  contactMethod?: "email" | "phone" | null;
  hasContact?: boolean;
  submittedAt?: string | null;
  notificationStatus?: string | null;
  notificationOutboxId?: string | null;
  route?: string | null;
  updatedAt?: string | null;
  userTexts?: string[];
};

export type ReconcileKind =
  | "excluded_owner_test"
  | "declined"
  | "delivered"
  | "queued_retry"
  | "incomplete_no_contact"
  | "missed_interest"
  | "provider_failure";

export type ReconcileRow = {
  sessionId: string;
  kind: ReconcileKind;
  interest: "website" | "landscaping" | "none";
  route: string | null;
  updatedAt: string | null;
  captureState: string;
  outboxState: string | null;
  hasUsableContact: boolean;
  nextAction: string;
  alertKey: string;
};

export function launchReconcileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ISCOTT_LAUNCH_RECONCILE_ENV] === "true";
}

export function reconcileAlertKey(sessionId: string, kind: ReconcileKind): string {
  return `iscott-reconcile:${sessionId}:${kind}`;
}

export function classifyLeadReconcile(lead: ReconcileLead): ReconcileRow {
  const traffic = lead.trafficClass ?? "public";
  const interest = classifyPublicInterest(lead.userTexts ?? []);
  const hasUsableContact = Boolean(lead.hasContact && lead.contactMethod);
  const outboxState = lead.notificationStatus ?? null;
  const captureState = [
    lead.status ?? "capturing",
    lead.consentStatus ?? "unknown",
    hasUsableContact ? "contact" : "no_contact",
  ].join("/");

  let kind: ReconcileKind = "incomplete_no_contact";
  let nextAction = "No owner action. Incomplete capture.";
  if (traffic === "owner" || traffic === "test") {
    kind = "excluded_owner_test";
    nextAction = "Excluded. Do not alert.";
  } else if (lead.consentStatus === "declined" || lead.status === "declined") {
    kind = "declined";
    nextAction = "Visitor declined. Do not send.";
  } else if (outboxState === "sent") {
    kind = "delivered";
    nextAction = "Handoff already delivered.";
  } else if (outboxState === "pending" || outboxState === "sending" || outboxState === "queued") {
    kind = "queued_retry";
    nextAction = "Wait for the existing outbox retry. Do not duplicate.";
  } else if (outboxState === "failed" || outboxState === "dead_letter") {
    kind = "provider_failure";
    nextAction = "Provider failed after capture. Inspect outbox. Do not dump contact values.";
  } else if (interest !== "none" && !hasUsableContact) {
    kind = "incomplete_no_contact";
    nextAction = "Public interest without a usable contact.";
  } else if (interest !== "none" && hasUsableContact && outboxState !== "sent") {
    kind = "missed_interest";
    nextAction = "Public interest captured, no successful handoff.";
  }

  return {
    sessionId: lead.sessionId,
    kind,
    interest,
    route: lead.route ?? null,
    updatedAt: lead.updatedAt ?? null,
    captureState,
    outboxState,
    hasUsableContact,
    nextAction,
    alertKey: reconcileAlertKey(lead.sessionId, kind),
  };
}

export function reportableReconcileRows(leads: ReconcileLead[]): ReconcileRow[] {
  const seen = new Set<string>();
  const out: ReconcileRow[] = [];
  for (const lead of leads) {
    const row = classifyLeadReconcile(lead);
    if (row.kind === "excluded_owner_test" || row.kind === "delivered" || row.kind === "declined") continue;
    if (row.kind === "queued_retry") continue;
    if (seen.has(row.alertKey)) continue;
    seen.add(row.alertKey);
    out.push(row);
  }
  return out;
}
