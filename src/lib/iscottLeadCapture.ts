import { visitorChoseContactMethod } from "./iscottLeadCaptureUi";
import { truncateUtf8String } from "./apiRouteSecurity";
import {
  notifyIScottLeadByEmail,
} from "./voiceEmailNotifications";
import type { IScottVisitorConfirmationResult } from "./voiceEmailNotifications";
import * as voiceEmailNotifications from "./voiceEmailNotifications";
import {
  ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS,
  ISCOTT_VISITOR_CONFIRMATION_ENABLED,
} from "./iscottVisitorConfirmation";
import type { IScottVisitorConfirmationStatus } from "./iscottVisitorConfirmation";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { queueSupabaseOperationalAlert } from "./wildworksOperationalAlerts";
import {
  collectBargeInEvents,
  collectOperatorPromptEchoEvents,
  detectsAcceptedFollowUp,
  detectsContactReadBackCorrect,
  detectsFollowUpAcceptance,
  detectsSimpleAffirmation,
  evaluateIScottLeadSendQualification,
  evaluateLeadPackageChronology,
  extractContactPreference,
  extractEmail,
  extractLocation,
  extractOperatorSiteNote,
  extractProjectNeed,
  extractSpokenFullName,
  formatLeadContactDisplay,
  formatLeadTranscript,
  formatSpokenEmailForReadback,
  formatSpokenPhoneForReadback,
  iscottEmailReadbackPrompt,
  mergeLeadTranscriptHistory,
  isMeaningfulVisitorName,
  isOperatorPromptEcho,
  isOperatorSalesLanguage,
  isProfanityEscalation,
  isSpecificFeedback,
  isSpecificProjectNeed,
  LeadNotQualifiedError,
  leadPackageFieldChanged,
  preferProjectNeed,
  sameContactValue,
  spokenPreferenceSignal,
  sessionLooksLikeOperatorQa,
  shouldParseLeadFacts,
  visitorProjectNeedFromRows,
} from "./iscottLeadParsing";
import { classifyTraffic, trafficColumns } from "./trafficClassification";
import {
  ISCOTT_TEST_HELD_STATUS,
  canDispatchIScottLeadNotification,
} from "./iscottTrafficResolve";

export {
  detectsAcceptedFollowUp,
  detectsContextualContactSendConfirmation,
  detectsSimpleAffirmation,
  extractProjectNeed,
  preferProjectNeed,
} from "./iscottLeadParsing";

const PHONE_PATTERN = /(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){9,15}\d/g;
// Prevent a new parser rule from replaying a lead captured before the rule
// existed. Older leads remain available to the explicit confirmation route.
const CONTEXTUAL_CONFIRMATION_INTRODUCED_AT = Date.parse("2026-08-16T17:30:00.000Z");

export type IScottTranscriptRow = {
  role: "user" | "assistant";
  message: string;
  laAbsoluteTimestamp: number | null;
};

export type IScottLeadState = {
  sessionId: string;
  status: "capturing" | "ready_for_confirmation" | "confirmed" | "submitted" | "declined";
  consentStatus: "unknown" | "accepted" | "declined";
  fullName: string | null;
  location: string | null;
  projectNeed: string | null;
  contactMethod: "email" | "phone" | null;
  email: string | null;
  phone: string | null;
  contactConfirmedAt: string | null;
  submittedAt: string | null;
  notificationStatus: string | null;
  notificationOutboxId: string | null;
  mediaCount: number;
  displayValue: string | null;
  maskedValue: string | null;
  ariaLabel: string | null;
  spokenReadback: string | null;
  spokenReadbackPrompt: string | null;
};

type LeadRow = {
  session_id: string;
  anonymous_visitor_id: string | null;
  source_route: string | null;
  status: IScottLeadState["status"];
  consent_status: IScottLeadState["consentStatus"];
  full_name: string | null;
  location: string | null;
  project_need: string | null;
  contact_method: IScottLeadState["contactMethod"];
  email: string | null;
  phone: string | null;
  contact_confirmed_at: string | null;
  submitted_at: string | null;
  notification_outbox_id: string | null;
  notification_status: string | null;
  // Visitor-receipt linkage, kept entirely separate from the owner columns
  // above so neither can be mistaken for the other. Written only by the
  // preparation path below, and only once the migration has been applied.
  visitor_confirmation_recipient?: string | null;
  visitor_confirmation_outbox_id?: string | null;
  visitor_confirmation_idempotency_key?: string | null;
  visitor_confirmation_package_version_hash?: string | null;
  visitor_confirmation_status?: IScottVisitorConfirmationStatus;
  visitor_confirmation_provider_accepted_at?: string | null;
  // Only a separately authorized, authenticated provider webhook may ever set
  // this. Nothing in this file writes it.
  visitor_confirmation_inbox_delivered_at?: string | null;
  visitor_confirmation_block_reason?: string | null;
  traffic_class?: "owner" | "test" | "public" | "bot";
  traffic_reason?: string;
  traffic_confidence?: number;
  transcript_text: string | null;
  transcript_snapshot: unknown[];
  media_snapshot: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  session_id: string | null;
  anonymous_visitor_id: string | null;
  upload_id: string;
  bucket: string;
  object_path: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type LeadOutboxRow = {
  id: string;
  status: "pending" | "sending" | "sent" | "failed" | "dead_letter";
};

type FailedLeadRetry = {
  outboxId: string;
  submittedAt: string | null;
};

type RestResult<T> = {
  ok: boolean;
  status: number;
  rows: T[];
  detail: string;
};

function adminHeaders(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function rest<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; prefer?: string } = {},
): Promise<RestResult<T>> {
  const resource = path.split(/[?&/]/, 1)[0] || "lead-data";
  const operation = `${init.method ?? "GET"} ${resource}`;
  if (!isSupabaseAdminConfigured()) {
    queueSupabaseOperationalAlert({ component: "iScott lead database", operation, failureKind: "configuration", correlationSource: `iscott-lead:${resource}:configuration` });
    return { ok: false, status: 0, rows: [], detail: "supabase_not_configured" };
  }
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: init.method ?? "GET",
      headers: adminHeaders(serviceRoleKey, init.prefer),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
    });
    const detail = response.ok ? "" : await response.text().catch(() => "");
    if (!response.ok) {
      queueSupabaseOperationalAlert({ component: "iScott lead database", operation, statusCode: response.status, correlationSource: `iscott-lead:${resource}:${response.status}` });
    }
    const data: unknown = response.ok ? await response.json().catch(() => []) : [];
    return {
      ok: response.ok,
      status: response.status,
      rows: Array.isArray(data) ? (data as T[]) : [],
      detail,
    };
  } catch (error) {
    queueSupabaseOperationalAlert({ component: "iScott lead database", operation, correlationSource: `iscott-lead:${resource}:connectivity` });
    return {
      ok: false,
      status: 0,
      rows: [],
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizePhone(value: string): string | null {
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

function extractPhone(text: string): string | null {
  for (const match of text.match(PHONE_PATTERN) ?? []) {
    const phone = normalizePhone(match);
    if (phone) return phone;
  }
  const digitWords: Record<string, string> = {
    zero: "0",
    oh: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
  };
  const spokenDigits = (text.toLowerCase().match(/\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g) ?? [])
    .map((word) => digitWords[word])
    .join("");
  if (spokenDigits.length >= 10 && spokenDigits.length <= 15) {
    return /\bplus\b/i.test(text) ? `+${spokenDigits}` : spokenDigits;
  }
  return null;
}

function extractFullName(text: string): string | null {
  return extractSpokenFullName(text);
}

function userTurnTexts(rows: IScottTranscriptRow[]): string[] {
  const turns: string[] = [];
  let fragments: string[] = [];
  const flush = () => {
    const text = fragments.join(" ").replace(/\s+/g, " ").trim();
    if (text) turns.push(text);
    fragments = [];
  };

  for (const row of rows) {
    if (row.role === "user" && row.message.trim()) {
      fragments.push(row.message.trim());
    } else {
      flush();
    }
  }
  flush();
  return turns;
}

function extractContactMethod(text: string): "email" | "phone" | null {
  return visitorChoseContactMethod(text);
}

function detectsDeclinedFollowUp(text: string): boolean {
  return /\b(?:do not|don't)\s+(?:contact|call|email)|\bno\s+follow[- ]?up\b|\bnot interested\b/i.test(text);
}

function isOperatorCorrection(text: string): boolean {
  return /\b(?:what you should say|you should say|then you say|as soon as i say|make sure|we need to|we got to|you(?:'ve)? got to|needs? to be corrected|don't say|do not say|take down this|it(?:'s| is) got to go away|there should(?:n't| not)? be any click|the max|stop everything and do that)\b/i.test(text)
    || isOperatorSalesLanguage(text);
}

export const iscottLeadCaptureTestUtils = {
  detectsAcceptedFollowUp,
  detectsSimpleAffirmation,
  extractContactMethod,
  // Exported 2026-08-19 so check-iscott-ride-89c453ff-replay.mjs can drive G's
  // real turns through the real extractors instead of asserting on source text.
  extractPhone,
  extractProjectNeed,
  extractFullName,
  isOperatorCorrection,
  preferProjectNeed,
  userTurnTexts,
};

function sourceEventKey(
  sessionId: string,
  row: IScottTranscriptRow,
  kind: "transcript" | "feedback" | "preference",
): string {
  const source = `${sessionId}\u0000${row.laAbsoluteTimestamp ?? "none"}\u0000${row.role}\u0000${row.message}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `iscott:${kind}:${sessionId}:${row.laAbsoluteTimestamp ?? "none"}:${(hash >>> 0).toString(16)}`;
}

// metadata is a free-form JSON column, so ANYTHING can be sitting in
// last_sent_contact - a number, an object, a leftover null from an older shape.
// It is read as a string or not at all: a value of some other type must never
// take part in an idempotency comparison, because a comparison it silently
// fails is a duplicate package to Scott, and one it silently passes is a lead
// that never travels.
function lastSentContact(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.last_sent_contact;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function preferLonger(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current || next.length > current.length) return next;
  return current;
}

function leadTranscriptFields(
  rows: IScottTranscriptRow[],
  existing: LeadRow | null,
): { transcript_text: string | null; transcript_snapshot: unknown[] } {
  const history = mergeLeadTranscriptHistory(
    Array.isArray(existing?.transcript_snapshot) ? existing.transcript_snapshot as Array<{
      role?: string;
      message?: string;
      timestamp?: number | null;
    }> : [],
    rows,
  );
  if (history.length === 0) {
    return {
      transcript_text: existing?.transcript_text ?? null,
      transcript_snapshot: existing?.transcript_snapshot ?? [],
    };
  }
  return formatLeadTranscript(history);
}

function toState(row: LeadRow): IScottLeadState {
  const method = row.contact_method === "phone" || row.contact_method === "email" ? row.contact_method : null;
  const raw = method === "phone" ? row.phone : method === "email" ? row.email : null;
  const display = method && raw ? formatLeadContactDisplay(method, raw) : null;
  return {
    sessionId: row.session_id,
    status: row.status,
    consentStatus: row.consent_status,
    fullName: row.full_name,
    location: row.location,
    projectNeed: row.project_need,
    contactMethod: row.contact_method,
    email: row.email,
    phone: row.phone,
    contactConfirmedAt: row.contact_confirmed_at,
    submittedAt: row.submitted_at,
    notificationStatus: row.notification_status,
    notificationOutboxId: row.notification_outbox_id,
    mediaCount: Array.isArray(row.media_snapshot) ? row.media_snapshot.length : 0,
    displayValue: display?.checkable ?? raw,
    maskedValue: display?.visible ?? null,
    ariaLabel: display?.ariaLabel ?? null,
    spokenReadback: method === "email" && raw ? formatSpokenEmailForReadback(raw) || null
      : method === "phone" && raw ? formatSpokenPhoneForReadback(raw) || null : null,
    spokenReadbackPrompt: method === "email" && raw ? iscottEmailReadbackPrompt(raw) : null,
  };
}

export function leadStateForDisplay(row: LeadRow): IScottLeadState {
  return toState(row);
}

async function readLead(sessionId: string): Promise<LeadRow | null> {
  const result = await rest<LeadRow>(
    `iscott_leads?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`,
  );
  if (!result.ok) throw new Error(`iscott_leads read failed (${result.status}): ${result.detail}`);
  return result.rows[0] ?? null;
}

async function writeLead(row: Record<string, unknown>): Promise<LeadRow> {
  const result = await rest<LeadRow>("iscott_leads?on_conflict=session_id&select=*", {
    method: "POST",
    body: [row],
    prefer: "resolution=merge-duplicates,return=representation",
  });
  if (!result.ok || !result.rows[0]) {
    throw new Error(`iscott_leads upsert failed (${result.status}): ${result.detail}`);
  }
  return result.rows[0];
}

async function insertExtractionEvents(
  sessionId: string,
  rows: IScottTranscriptRow[],
  anonymousVisitorId?: string | null,
  route?: string | null,
): Promise<void> {
  const payloads: Record<string, unknown>[] = [];
  const feedback: Record<string, unknown>[] = [];
  const preferences: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (row.role !== "user") continue;
    const operator = isOperatorCorrection(row.message);
    const specific = isSpecificFeedback(row.message);
    const profane = isProfanityEscalation(row.message);
    const preference = spokenPreferenceSignal(row.message);
    if (shouldParseLeadFacts(row.message) || operator) {
      const email = extractEmail(row.message);
      const phone = extractPhone(row.message);
      const fullName = extractFullName(row.message);
      const location = extractLocation(row.message);
      const projectNeed = extractProjectNeed(row.message);
      const contactMethod = extractContactMethod(row.message);
      if (email || phone || fullName || location || projectNeed || contactMethod || operator) {
        payloads.push({
          source_event_key: sourceEventKey(sessionId, row, "transcript"),
          session_id: sessionId,
          transcript: row.message,
          extracted_email: email,
          extracted_phone: phone,
          extracted_name: fullName,
          follow_up_intent: detectsDeclinedFollowUp(row.message)
            ? "declined"
            : detectsAcceptedFollowUp(row.message)
              ? "interested"
              : "neutral",
          metadata: {
            la_absolute_timestamp: row.laAbsoluteTimestamp,
            location,
            project_need: projectNeed,
            contact_method: contactMethod,
            source: "iscott_lead_capture",
          },
        });
      }
    }
    if (operator || specific || profane) {
      feedback.push({
        source_event_key: sourceEventKey(sessionId, row, "feedback"),
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId ?? null,
        sentiment: "negative",
        severity: profane ? "high" : "medium",
        phrase: truncateUtf8String(row.message, 1_000),
        mode: operator ? "iscott-coaching" : "iscott-visitor-correction",
        route: route ?? null,
        payload: {
          la_absolute_timestamp: row.laAbsoluteTimestamp,
          kind: profane ? "profanity_escalation" : specific ? "explicit_correction" : "operator_correction",
        },
      });
    }
    if (operator || preference) {
      preferences.push({
        source_event_key: sourceEventKey(sessionId, row, "preference"),
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId ?? null,
        category: operator ? "iscott_coaching" : "iscott_spoken_preference",
        signal: truncateUtf8String(row.message, 700),
        source_text: truncateUtf8String(row.message, 1_000),
        confidence: 0.95,
        payload: { la_absolute_timestamp: row.laAbsoluteTimestamp },
      });
    }
  }
  const siteNote = extractOperatorSiteNote(
    rows.filter((row) => row.role === "user").map((row) => row.message),
  );
  if (siteNote) {
    feedback.push({
      source_event_key: sourceEventKey(sessionId, {
        role: "user",
        message: siteNote,
        laAbsoluteTimestamp: null,
      }, "feedback"),
      session_id: sessionId,
      anonymous_visitor_id: anonymousVisitorId ?? null,
      sentiment: "neutral",
      severity: "low",
      phrase: truncateUtf8String(siteNote, 1_000),
      mode: "iscott-operator-site-note",
      route: route ?? null,
      payload: { kind: "site_quality" },
    });
  }
  for (const echo of collectOperatorPromptEchoEvents(sessionId, rows, anonymousVisitorId)) {
    preferences.push({
      ...echo,
      source_event_key: sourceEventKey(sessionId, {
        role: "assistant",
        message: String(echo.source_text ?? ""),
        laAbsoluteTimestamp: (echo.payload as { la_absolute_timestamp?: number | null } | undefined)
          ?.la_absolute_timestamp ?? null,
      }, "preference"),
    });
  }
  for (const barge of collectBargeInEvents(sessionId, rows, anonymousVisitorId)) {
    preferences.push({
      ...barge,
      source_event_key: sourceEventKey(sessionId, {
        role: "user",
        message: String(barge.signal ?? "barge-in"),
        laAbsoluteTimestamp: (barge.payload as { user_timestamp?: number | null } | undefined)
          ?.user_timestamp ?? null,
      }, "preference"),
    });
  }
  const results = await Promise.all([
    payloads.length
      ? rest("transcript_events?on_conflict=source_event_key", {
          method: "POST",
          body: payloads,
          prefer: "resolution=ignore-duplicates,return=minimal",
        })
      : Promise.resolve(null),
    feedback.length
      ? rest("feedback_events?on_conflict=source_event_key", {
          method: "POST",
          body: feedback,
          prefer: "resolution=ignore-duplicates,return=minimal",
        })
      : Promise.resolve(null),
    preferences.length
      ? rest("preference_candidates?on_conflict=source_event_key", {
          method: "POST",
          body: preferences,
          prefer: "resolution=ignore-duplicates,return=minimal",
        })
      : Promise.resolve(null),
  ]);
  const failed = results.find((result) => result && !result.ok);
  if (failed) {
    throw new Error(`iscott extraction event write failed (${failed.status}): ${failed.detail}`);
  }
}

export async function processIScottTranscriptRows(args: {
  sessionId: string;
  anonymousVisitorId?: string | null;
  route?: string | null;
  rows: IScottTranscriptRow[];
}): Promise<IScottLeadState | null> {
  const existing = await readLead(args.sessionId);
  const rows = mergeLeadTranscriptHistory(
    Array.isArray(existing?.transcript_snapshot) ? existing.transcript_snapshot as Array<{
      role?: string;
      message?: string;
      timestamp?: number | null;
    }> : [],
    args.rows,
  );
  const existingTranscriptRows = mergeLeadTranscriptHistory(
    Array.isArray(existing?.transcript_snapshot) ? existing.transcript_snapshot as Array<{
      role?: string;
      message?: string;
      timestamp?: number | null;
    }> : [],
    [],
  );
  // Stored history is emitted first; only genuinely new incoming transcript
  // rows follow it. This boundary prevents an old package's read-back and yes
  // from becoming permission for a later changed-contact package.
  const freshRows = rows.slice(existingTranscriptRows.length);
  const userRows = rows.filter((row) => row.role === "user" && row.message.trim());
  let fullName = existing?.full_name ?? null;
  let location = existing?.location ?? null;
  let projectNeed = existing?.project_need ?? null;
  let email = existing?.email ?? null;
  let phone = existing?.phone ?? null;
  let contactMethod = existing?.contact_method ?? null;
  let consentStatus = existing?.consent_status ?? "unknown";
  let contactConfirmedAt = existing?.contact_confirmed_at ?? null;
  const captureTime = new Date().toISOString();

  // Grok's forensics on ride 89c453ff, 2026-08-19: after the contact was settled,
  // G kept SAYING the words "email" and "phone" while talking about the screen -
  // "it should say phone and email sent", "I have not received an email" - and
  // every one of those restamped contact_method. Talking about the interface is
  // not choosing how to be reached.
  //
  // Once a contact has been confirmed, only a turn that actually CARRIES a new
  // contact value may change the preference. Before anything is confirmed, a bare
  // "email's great" is exactly how a visitor answers the question, so it still
  // counts.
  const methodChangeIsCredible = (text: string, confirmed: boolean): boolean =>
    !confirmed || Boolean(extractEmail(text)) || Boolean(extractPhone(text));

  for (const text of userTurnTexts(rows)) {
    const methodOnly = extractContactMethod(text);
    const methodCredible = methodChangeIsCredible(text, Boolean(contactConfirmedAt));
    if (!shouldParseLeadFacts(text) && !isOperatorCorrection(text)) {
      if (methodOnly && methodCredible) contactMethod = methodOnly;
      continue;
    }
    // A CORRECTION REPLACES; A FULLER ANSWER FILLS IN. 2026-08-30.
    //
    // Both of these used to keep whichever value was LONGER, which is right for
    // "George" becoming "George Smith" and wrong for "actually, my name is
    // Gregory Vance" - a visitor who corrected themselves kept the old name on
    // the package, and after they re-confirmed, that old name is what would
    // have travelled to Scott. Material changes are taken; refinements still
    // merge the way they always did.
    // A REPLACEMENT NEEDS AN INTRODUCTION. G's ride 129b69d6, 2026-08-31.
    //
    // The rule above is right that "actually, my name is Gregory Vance" must
    // REPLACE an earlier "George" rather than merge with it. What it did not
    // check is whether the new name arrived as an introduction at all. On that
    // ride the extractor produced "Information" out of the middle of a normal
    // sentence, leadPackageFieldChanged agreed it was materially different from
    // "Scott", and the real name G had given two minutes earlier was thrown
    // away. The parser fault is fixed in extractSpokenNameAndPlace; this is the
    // second lock, so a bad extraction can never again overwrite a good name.
    //
    // Replacing requires the visitor to actually say who they are. Without a
    // cue a new reading can still FILL IN an empty name, or lengthen one
    // ("George" -> "George Smith"), which is what preferLonger already does.
    const spokenName = extractFullName(text);
    if (spokenName) {
      const introducesName = /\b(?:my name is|my name's|call me|i(?:'m| am)|this is|it's|its)\b/i.test(text);
      const mayReplace =
        isMeaningfulVisitorName(spokenName) &&
        leadPackageFieldChanged("name", fullName, spokenName) &&
        (!fullName || introducesName);
      fullName = mayReplace ? spokenName : preferLonger(fullName, spokenName);
    }
    location = extractLocation(text) ?? location;
    const spokenNeed = extractProjectNeed(text);
    if (spokenNeed) {
      projectNeed = isSpecificProjectNeed(spokenNeed) && leadPackageFieldChanged("intent", projectNeed, spokenNeed)
        ? spokenNeed
        : preferProjectNeed(projectNeed, spokenNeed);
    }

    const previousEmail = email;
    const previousPhone = phone;
    const nextEmail = extractEmail(text);
    const nextPhone = extractPhone(text);

    // G 2026-08-19: "people are going to start in the middle ... the system
    // should be built to be smart enough to do that." Once the visitor has
    // confirmed a spelled read-back, that address is settled. A later passing
    // mention of it must not silently replace the confirmed value - only an
    // explicit correction can. On G's ride he confirmed the visitor's address and then
    // kept talking ABOUT the address, and the talking overwrote the answer.
    const contactAlreadyConfirmed = Boolean(contactConfirmedAt);
    const soundsLikeCorrection =
      isOperatorCorrection(text) ||
      /\b(?:no|not|nope|actually|i said|it'?s|that'?s|should be|correction|wrong|instead)\b/i.test(text);
    // REGRESSION FIX, 2026-08-19, and the regression was mine from earlier the
    // same night. Making a confirmed contact sticky ALSO blocked a legitimate
    // change of method. On G's ride he gave an email, confirmed it, then said
    // "can I have Scott reach me by my phone number?" and read the number out.
    // Because a contact was already confirmed, and a phone number does not
    // "sound like a correction", the number was never stored - and the lead was
    // still submitted and mailed to Scott carrying the OLD email and an empty
    // phone. A lead reached him with the wrong way to answer it.
    //
    // Switching method is a NEW capture, not prose about the old one. It always
    // takes the value, clears the old confirmation so the new value must be
    // confirmed on its own, and drops the abandoned method's value so it cannot
    // ride along on the lead.
    const methodSwitched = Boolean(methodOnly) && methodCredible && methodOnly !== contactMethod;
    if (!contactAlreadyConfirmed || soundsLikeCorrection || methodSwitched) {
      email = nextEmail ?? email;
      phone = nextPhone ?? phone;
    }
    // G's ride 89c453ff, 2026-08-19 12:23. The lead row came out with BOTH
    // email and phone NULL while the mail to Scott carried the phone - the row
    // hollowed out behind a lead that had already gone. Dropping the abandoned
    // method destroyed one value per switch, and G's later turns flipped the
    // method more than once, so both were destroyed.
    //
    // The dropping was mine, from the 6f3a7caa fix hours earlier, and it was the
    // wrong lesson. That lead failed because the PHONE was never captured, not
    // because the email rode along. G, on this ride, asked for the opposite of
    // dropping: "let me give you my phone number also, and Scott can reach out
    // with me either way."
    //
    // So: a captured contact value is NEVER destroyed. Switching method changes
    // which one Scott is asked to use first; it does not throw away a way to
    // reach the visitor. The read-back still has to confirm the new value, which
    // is what clearing the confirmation below is for.
    // A8, Grok, same ride: the row came out submitted AND sent with
    // consent_status "unknown" and contact_confirmed_at null, because turns after
    // the send re-opened consent on a lead that had already reached Scott. A
    // package that has gone cannot become unconsented afterwards - the visitor
    // said yes and Scott has the mail. Only a lead still in flight can be
    // re-opened.
    const leadAlreadyClosed = existing?.status === "confirmed" || existing?.status === "submitted";
    if (methodSwitched && !leadAlreadyClosed) {
      contactConfirmedAt = null;
      consentStatus = "unknown";
    }
    contactMethod = (methodOnly && methodCredible ? methodOnly : null) ?? contactMethod;

    // CHANGED means a different way to reach the person, not a differently
    // formatted spelling of the same one. Compared with === , a visitor who
    // repeats "four four three, five five five, oh one four two" after giving
    // "+1 (443) 555-0142" tore down their own confirmed consent and had to
    // start the read-back again.
    const contactChanged = Boolean(
      (previousEmail && email && !sameContactValue("email", previousEmail, email)) ||
      (previousPhone && phone && !sameContactValue("phone", previousPhone, phone)),
    );
    if (contactChanged && existing?.status !== "confirmed" && existing?.status !== "submitted") {
      contactConfirmedAt = null;
      consentStatus = "unknown";
    }

    const hasCurrentContact = Boolean(
      contactMethod === "phone" ? phone : contactMethod === "email" ? email : email || phone,
    );
    if (detectsDeclinedFollowUp(text)) {
      consentStatus = "declined";
      continue;
    }
    if (isOperatorCorrection(text) || !hasCurrentContact) continue;
  }
  const capturedNeed = visitorProjectNeedFromRows(userTurnTexts(rows));
  if (projectNeed && (isOperatorSalesLanguage(projectNeed) || /salesman|super positive/i.test(projectNeed))) {
    projectNeed = null;
  }
  projectNeed = capturedNeed.projectNeed ?? projectNeed;
  if (!contactMethod) {
    if (email && !phone) contactMethod = "email";
    else if (phone && !email) contactMethod = "phone";
  }

  // Grok, same forensics: the row read contact_method "phone" with phone NULL.
  // A lead must never claim a way to be reached that it does not hold - that is
  // what put an unanswerable lead in front of Scott. If the named method has no
  // value, fall back to whichever one does rather than advertising an empty one.
  if (contactMethod === "phone" && !phone && email) contactMethod = "email";
  if (contactMethod === "email" && !email && phone) contactMethod = "phone";

  const previousPackageMethod = existing?.contact_method === "phone" || existing?.contact_method === "email"
    ? existing.contact_method
    : null;
  const previousPackageContact = previousPackageMethod === "phone"
    ? existing?.phone ?? null
    : previousPackageMethod === "email"
      ? existing?.email ?? null
      : null;
  const currentContact = contactMethod === "email" ? email : contactMethod === "phone" ? phone : null;
  const hasSubmittedPackage = Boolean(
    existing && (
      existing.status === "submitted" ||
      existing.status === "confirmed" ||
      existing.submitted_at ||
      existing.notification_outbox_id ||
      existing.notification_status === "sent" ||
      existing.notification_status === "queued"
    ),
  );
  const postSubmitContactChanged = Boolean(
    hasSubmittedPackage &&
    contactMethod &&
    currentContact &&
    (
      !previousPackageMethod ||
      !previousPackageContact ||
      previousPackageMethod !== contactMethod ||
      !sameContactValue(contactMethod, previousPackageContact, currentContact)
    ),
  );
  const exactFreshContactChangeIndex = postSubmitContactChanged && contactMethod && currentContact
    ? freshRows.findIndex((row) => {
        if (row.role !== "user") return false;
        const mentioned = contactMethod === "phone" ? extractPhone(row.message) : extractEmail(row.message);
        return sameContactValue(contactMethod, mentioned, currentContact);
      })
    : -1;
  const freshContactChangeIndex = exactFreshContactChangeIndex >= 0
    ? exactFreshContactChangeIndex
    : postSubmitContactChanged
      ? freshRows.findIndex((row) => row.role === "user")
      : -1;
  const existingPackageStartIndex = typeof existing?.metadata?.current_contact_package_start_index === "number" &&
    Number.isInteger(existing.metadata.current_contact_package_start_index) &&
    existing.metadata.current_contact_package_start_index >= 0
    ? existing.metadata.current_contact_package_start_index
    : null;
  const currentPackageRows = postSubmitContactChanged && freshContactChangeIndex >= 0
    ? freshRows.slice(freshContactChangeIndex)
    : existingPackageStartIndex !== null && existingPackageStartIndex < rows.length
      ? rows.slice(existingPackageStartIndex)
      : existingPackageStartIndex !== null || postSubmitContactChanged
      ? []
      : rows;
  if (postSubmitContactChanged) {
    contactConfirmedAt = null;
    consentStatus = userTurnTexts(currentPackageRows).some((text) => detectsDeclinedFollowUp(text))
      ? "declined"
      : "unknown";
  }

  const isPostRolloutLead = !existing || Date.parse(existing.created_at) >= CONTEXTUAL_CONFIRMATION_INTRODUCED_AT;
  // WHERE THE PERMISSION SITS IN THE CONVERSATION, 2026-08-30. The yes is only
  // permission for the package that was on the table when it was said. This walk
  // reports both facts at once: that a yes exists for the contact we hold, and
  // whether the name, the job or the contact moved under it afterwards.
  const packageChronology = contactMethod && currentContact
    ? evaluateLeadPackageChronology({
        rows: currentPackageRows,
        fullName,
        projectNeed,
        contactMethod,
        contactValue: currentContact,
      })
    : null;
  // A lead Scott already has cannot be re-opened by later turns - that was
  // settled on ride 89c453ff and it still holds. Only a package still in flight
  // can lose its permission.
  const leadInFlight = existing?.status !== "confirmed" && existing?.status !== "submitted";
  // Consent belongs to one exact contact package. After a submitted contact
  // changes, only rows added from the change turn onward may prove the new
  // read-back and adjacent permission; prior package truth remains historical.
  if (
    consentStatus !== "declined" &&
    contactMethod &&
    currentContact &&
    isPostRolloutLead &&
    packageChronology?.permissionCurrent
  ) {
    contactConfirmedAt = contactConfirmedAt ?? captureTime;
    consentStatus = "accepted";
  } else if (
    leadInFlight &&
    consentStatus !== "declined" &&
    packageChronology &&
    packageChronology.staleFields.length > 0
  ) {
    // The visitor gave permission and then changed the package. The row must not
    // keep carrying a confirmation that no longer describes anything, or the
    // panel will offer a Send for a package nobody agreed to. Cleared here, and
    // refused again at the send gate for anything that reaches it another way.
    contactConfirmedAt = null;
    consentStatus = "unknown";
  }

  const hasContact = Boolean(contactMethod === "phone" ? phone : contactMethod === "email" ? email : email || phone);
  let status: LeadRow["status"] = consentStatus === "declined"
    ? "declined"
    : hasContact
      ? "ready_for_confirmation"
      : "capturing";
  if (!postSubmitContactChanged && (existing?.status === "confirmed" || existing?.status === "submitted")) {
    status = existing.status;
  }

  const transcriptFields = leadTranscriptFields(args.rows, existing);
  let currentPackageStartIndex = existingPackageStartIndex;
  if (postSubmitContactChanged && contactMethod && currentContact) {
    const snapshot = Array.isArray(transcriptFields.transcript_snapshot)
      ? transcriptFields.transcript_snapshot as Array<{ role?: string; message?: string }>
      : [];
    for (let index = snapshot.length - 1; index >= 0; index -= 1) {
      const snapshotRow = snapshot[index];
      if (snapshotRow.role !== "user" || typeof snapshotRow.message !== "string") continue;
      const mentioned = contactMethod === "phone"
        ? extractPhone(snapshotRow.message)
        : extractEmail(snapshotRow.message);
      if (sameContactValue(contactMethod, mentioned, currentContact)) {
        currentPackageStartIndex = index;
        break;
      }
    }
  }

  let submittedAt = existing?.submitted_at ?? null;
  let notificationOutboxId = existing?.notification_outbox_id ?? null;
  let notificationStatus = existing?.notification_status ?? null;
  const submittedPackageHistory = Array.isArray(existing?.metadata?.submitted_package_history)
    ? [...existing.metadata.submitted_package_history]
    : [];
  if (postSubmitContactChanged) {
    if (existing?.submitted_at || existing?.notification_outbox_id || existing?.notification_status) {
      const priorPackage = {
        submitted_at: existing.submitted_at ?? null,
        notification_outbox_id: existing.notification_outbox_id ?? null,
        notification_status: existing.notification_status ?? null,
        contact_method: previousPackageMethod,
      };
      const alreadyRecorded = submittedPackageHistory.some((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const candidate = entry as Record<string, unknown>;
        return candidate.notification_outbox_id === priorPackage.notification_outbox_id &&
          candidate.submitted_at === priorPackage.submitted_at;
      });
      if (!alreadyRecorded) submittedPackageHistory.push(priorPackage);
    }
    submittedAt = null;
    notificationOutboxId = null;
    notificationStatus = null;
  }

  const now = captureTime;
  const userTexts = userTurnTexts(rows);
  let contactPreference: "sms" | "voice" | "email" | null = null;
  for (const text of userTexts) {
    contactPreference = extractContactPreference(text) ?? contactPreference;
  }
  const alreadyHeld =
    existing?.traffic_class === "owner" ||
    existing?.traffic_class === "test" ||
    existing?.notification_status === ISCOTT_TEST_HELD_STATUS ||
    existing?.metadata?.operator_qa === true;
  const operatorQa = alreadyHeld || sessionLooksLikeOperatorQa(userTexts);
  const traffic = operatorQa
    ? {
        trafficClass: (existing?.traffic_class === "test" ? "test" : "owner") as "owner" | "test",
        reason: existing?.traffic_reason === "codex_test_identifier" || existing?.traffic_reason === "owner_test_identifier"
          ? existing.traffic_reason
          : "operator_qa_session",
        confidence: 1,
      }
    : await classifyTraffic({
        anonymousVisitorId:
          args.anonymousVisitorId ??
          existing?.anonymous_visitor_id ??
          (/^(?:codex-|ww-test-|ww-owner-)/.test(args.sessionId) ? args.sessionId : null),
      });
  const row = await writeLead({
    session_id: args.sessionId,
    anonymous_visitor_id: args.anonymousVisitorId ?? existing?.anonymous_visitor_id ?? null,
    source_route: args.route ?? existing?.source_route ?? null,
    status,
    consent_status: consentStatus,
    full_name: fullName,
    location,
    project_need: projectNeed,
    contact_method: contactMethod,
    email,
    phone,
    contact_confirmed_at: contactConfirmedAt,
    submitted_at: submittedAt,
    notification_outbox_id: notificationOutboxId,
    notification_status: notificationStatus,
    ...trafficColumns(traffic),
    ...transcriptFields,
    media_snapshot: existing?.media_snapshot ?? [],
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(submittedPackageHistory.length > 0 ? { submitted_package_history: submittedPackageHistory } : {}),
      ...(currentPackageStartIndex !== null
        ? { current_contact_package_start_index: currentPackageStartIndex }
        : {}),
      last_capture_at: now,
      latest_user_timestamp: userRows.at(-1)?.laAbsoluteTimestamp ?? null,
      follow_up_accepted: detectsFollowUpAcceptance(currentPackageRows),
      contact_readback_correct: userTurnTexts(currentPackageRows).some((text) => detectsContactReadBackCorrect(text)),
      contact_preference: contactPreference,
      operator_prompt_echo: rows.some((row) => row.role === "assistant" && isOperatorPromptEcho(row.message)),
      sales_language: rows.some((row) => isOperatorSalesLanguage(row.message)),
      operator_service_script: capturedNeed.operatorServiceScript,
      operator_site_note: extractOperatorSiteNote(userTexts),
      operator_qa: operatorQa,
      frustration_escalation: userTexts.some((text) => isProfanityEscalation(text)),
    },
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });

  await insertExtractionEvents(args.sessionId, rows, args.anonymousVisitorId, args.route);

  // G 2026-08-19: "There is no tap." The visitor says yes out loud and the send
  // has to actually fire. Verbal consent used to only RECORD permission and then
  // wait on a button, so iScott's "tap Send to Scott" pointed at nothing. The
  // same confirmation that grants permission now completes the handoff.
  // Consent is not a bare "yes" - detectsContextualContactSendConfirmation above
  // requires iScott to have asked the send/permission question first, and the
  // yes to land inside the confirmation window.
  const spokenContact = row.contact_method === "phone" ? row.phone : row.email;
  // Grok's Supabase forensics on session 6f3a7caa, 2026-08-19: G sent an email
  // package, then changed his mind and gave a PHONE number. The row flipped its
  // method label to phone and Scott was never told - because "already handled"
  // treated the whole LEAD as done, when what was done was one PACKAGE for one
  // contact. A visitor who says "actually call me instead" has given Scott new
  // information and it has to travel.
  //
  // So: handled means handled FOR THIS CONTACT. If the contact that was sent is
  // not the contact we now hold, this is a fresh package.
  const sentContact = lastSentContact(row.metadata);
  const contactHeldNow = row.contact_method === "phone" ? row.phone : row.email;
  // Compared on the normalized value. A re-spoken phone with different spacing,
  // or the same address in different case, is the contact Scott ALREADY has -
  // and comparing those literally is how he receives the same lead twice.
  const contactAlreadySent = sameContactValue(
    row.contact_method === "phone" ? "phone" : "email",
    sentContact,
    contactHeldNow,
  );
  const alreadyHandled =
    contactAlreadySent ||
    ((row.status === "submitted" ||
      row.notification_status === "sent" ||
      row.notification_status === "queued") &&
      !sentContact);
  // QUALIFICATION. Scott is going to ring these people. A package only leaves
  // here carrying a name he can say, a job he can quote, and a contact the
  // visitor read back and said yes to. Anything short of that stays on the row
  // and keeps asking - it is never mailed as a half lead.
  const qualified = evaluateIScottLeadSendQualification({
    fullName: row.full_name,
    projectNeed: row.project_need,
    contactMethod: row.contact_method,
    contactValue: spokenContact,
    consentStatus: row.consent_status,
    contactConfirmedAt: row.contact_confirmed_at,
    rows,
  }).qualified;
  if (
    qualified &&
    !alreadyHandled &&
    row.consent_status === "accepted" &&
    row.contact_confirmed_at &&
    (row.contact_method === "email" || row.contact_method === "phone") &&
    spokenContact
  ) {
    try {
      const spokenSend = await confirmAndSubmitIScottLead({
        sessionId: args.sessionId,
        contactMethod: row.contact_method,
        contactValue: spokenContact,
      });
      return spokenSend.lead;
    } catch {
      // An auto-send failure must never break transcript capture. The visible
      // Send control stays as the fallback path.
    }
  }

  // NOTHING WITH A WAY TO REACH SOMEBODY IS ALLOWED TO DIE HERE.
  //
  // G, 2026-08-30: "all potential leads should be sent to me by email ... any
  // and all information, an email address, a phone number, anything, that gets
  // to me." When he said it, 11 leads holding a real email or phone had
  // reached ready_for_confirmation and never been mailed - including two
  // public visitors who left Baltimore phone numbers.
  //
  // This deliberately does NOT reuse the qualification gate above. That gate
  // guards a COMPLETED handoff and the visitor-facing receipt, and it should
  // stay strict. This is a different promise: if we hold a way to contact a
  // human, Scott finds out, even when the conversation fell apart. Keyed on
  // '#partial' so the outbox dedupes it once per session and it can never
  // collide with the real handoff mail.
  const partialContact = (row.email ?? "").trim() || (row.phone ?? "").trim();
  const neverNotified = !((row.notification_status ?? "").trim());
  if (partialContact && neverNotified && !alreadyHandled) {
    let partialOutcome: Record<string, unknown> = { attempted_at: new Date().toISOString() };
    try {
      // Reached through the namespace on purpose: the focused tests stub this
      // module, and an absent export must simply mean "no partial mail here"
      // rather than an exception thrown inside transcript capture.
      const sendPartial = voiceEmailNotifications.notifyIScottPartialLeadByEmail;
      if (typeof sendPartial !== "function") return toState(row);
      await sendPartial({
        eventId: `${args.sessionId}#partial`,
        sessionId: args.sessionId,
        fullName: row.full_name,
        location: row.location,
        projectNeed: row.project_need,
        contactMethod: row.contact_method === "phone" ? "phone" : "email",
        email: row.email,
        phone: row.phone,
        transcript: formatLeadTranscript(rows).transcript_text,
        metadata: {
          source: "iscott_liveavatar",
          lead_status: row.status,
          consent_status: row.consent_status,
          contact_confirmed: Boolean((row.contact_confirmed_at ?? "").trim()),
        },
      });
      partialOutcome = { ...partialOutcome, result: "sent" };
    } catch (error) {
      // Same rule as the strict path: a notification failure must never break
      // transcript capture. The lead row still holds everything.
      partialOutcome = {
        ...partialOutcome,
        result: "failed",
        error: String(error).slice(0, 300),
      };
    }
    // G, 2026-09-01: "Any potential leads I want to know about."
    // This send used to be the one promise in the pipeline with no record of
    // whether it was kept: the catch above swallowed the failure, and the
    // partial mail is keyed '#partial' in the outbox so it never touches
    // notification_status on the row either. When G asked tonight whether he
    // had been told about three stalled leads, there was no way to answer from
    // the data - and Resend's list endpoint refuses the sending key we hold, so
    // there was no way to answer from outside either.
    // Recorded on the row now, success or failure, so the question is always
    // answerable. Wrapped itself, because bookkeeping must never be the thing
    // that breaks capture.
    try {
      // Not reassigned into `row`: the caller's state does not need the note,
      // only the table does, and `row` is const by design here.
      await writeLead({
        session_id: args.sessionId,
        metadata: { ...(row.metadata ?? {}), partial_notification: partialOutcome },
      });
    } catch {
      // The mail either went or it did not; losing the note about it is not
      // worth failing the capture that holds the lead.
    }
  }

  return toState(row);
}

export async function getIScottLeadState(sessionId: string): Promise<IScottLeadState | null> {
  const row = await readLead(sessionId);
  return row ? toState(row) : null;
}

// Failed app_events inserts fall back into conversation_messages as role "user"
// (see insertConversationTelemetryFallback). Those JSON blobs are system noise,
// never visitor speech, and must never reach Scott's lead package or iScott's
// context. Filtered by source above; this is the belt-and-braces content guard.
function isTelemetryNoise(message: unknown): boolean {
  if (typeof message !== "string") return true;
  const trimmed = message.trimStart();
  if (!trimmed.startsWith("{")) return false;
  return /"table"\s*:/.test(trimmed) || /"tableInsertStatus"\s*:/.test(trimmed);
}

async function readTranscript(sessionId: string): Promise<{
  text: string;
  snapshot: Array<{ role: string; message: string; timestamp: number | null }>;
}> {
  const result = await rest<{
    role: string;
    message: string;
    la_absolute_timestamp: number | null;
  }>(
    `conversation_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=role,message,la_absolute_timestamp&source=not.in.(app_event,telemetry_fallback)&order=la_absolute_timestamp.asc&limit=700`,
  );
  if (!result.ok) throw new Error(`conversation transcript read failed (${result.status})`);
  const snapshot = result.rows
    .filter((row) => !isTelemetryNoise(row.message))
    .map((row) => ({
      role: row.role,
      message: row.message,
      timestamp: row.la_absolute_timestamp,
    }));
  const text = snapshot.map((row) => `${row.role === "assistant" ? "iSCOTT" : "VISITOR"}: ${row.message}`).join("\n\n");
  return { text, snapshot };
}

async function readMedia(lead: LeadRow): Promise<MediaRow[]> {
  const filters = [`session_id.eq.${encodeURIComponent(lead.session_id)}`];
  if (lead.anonymous_visitor_id) {
    filters.push(`anonymous_visitor_id.eq.${encodeURIComponent(lead.anonymous_visitor_id)}`);
  }
  const result = await rest<MediaRow>(
    `iscott_media?or=(${filters.join(",")})&select=*&order=created_at.asc&limit=100`,
  );
  if (!result.ok) throw new Error(`iscott media read failed (${result.status})`);
  return result.rows;
}

async function signMedia(media: MediaRow): Promise<string | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  try {
    const encodedPath = media.object_path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `${url}/storage/v1/object/sign/${encodeURIComponent(media.bucket)}/${encodedPath}`,
      {
        method: "POST",
        headers: adminHeaders(serviceRoleKey),
        // 2026-08-24: was 7 days. These links open a customer's private photos
        // of their own property and they sit in an inbox for as long as they
        // live. 12 hours is long enough for G to read the mail and look; a link
        // that leaks a week later is dead.
        body: JSON.stringify({ expiresIn: 12 * 60 * 60 }),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as
      | { signedURL?: string; signedUrl?: string }
      | null;
    const signed = body?.signedURL ?? body?.signedUrl ?? null;
    if (!signed) return null;
    return signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`;
  } catch {
    return null;
  }
}

function dashboardUrls(sessionId: string): { lead: string | null; transcript: string | null } {
  const { url } = getSupabaseAdminConfig();
  try {
    const ref = new URL(url).hostname.split(".")[0];
    if (!ref) return { lead: null, transcript: null };
    const filter = encodeURIComponent(`session_id=eq.${sessionId}`);
    return {
      lead: `https://supabase.com/dashboard/project/${ref}/editor/iscott_leads?filter=${filter}`,
      transcript: `https://supabase.com/dashboard/project/${ref}/editor/conversation_messages?filter=${filter}`,
    };
  } catch {
    return { lead: null, transcript: null };
  }
}

export async function confirmAndSubmitIScottLead(args: {
  sessionId: string;
  contactMethod: "email" | "phone";
  contactValue: string;
}): Promise<{
  lead: IScottLeadState;
  queued: boolean;
  delivered: boolean;
  detail: string;
}> {
  const existing = await readLead(args.sessionId);
  if (!existing) throw new Error("iscott_lead_not_found");

  const email = args.contactMethod === "email" ? extractEmail(args.contactValue) : existing.email;
  const phone = args.contactMethod === "phone" ? normalizePhone(args.contactValue) : existing.phone;
  if (args.contactMethod === "email" && !email) throw new Error("invalid_email");
  if (args.contactMethod === "phone" && !phone) throw new Error("invalid_phone");

  // THE CONFIRM API MANUFACTURES NOTHING. It used to write consent_status
  // "accepted" and stamp contact_confirmed_at on every call, so a POST to
  // /api/iscott/lead/confirm could conjure permission the visitor never gave and
  // mail a stranger's details to Scott on the strength of its own write.
  //
  // Permission is earned in the conversation and read here. The lead must
  // already hold accepted consent, a confirmed contact, a name, a job Scott can
  // act on, and the exact value this call is asking to send to.
  const heldContact = existing.contact_method === "phone"
    ? existing.phone
    : existing.contact_method === "email"
      ? existing.email
      : null;
  // 2026-08-29, CORRECTION. Reading consent_status and contact_confirmed_at off
  // the row was not enough. Those two columns are the CONCLUSION the capture
  // pipeline reached; a row written before the strict read-back rule existed
  // carries them with no proof behind them, and a direct POST to this route
  // could spend that stale conclusion.
  //
  // So the PROOF is read here, ahead of any write, and handed to the same gate:
  // the conversation the server itself stored, plus the snapshot the lead row
  // carries. Both are server-side truth - neither is anything this caller can
  // supply. A row that cannot show a read-back of the value it is asking to send
  // to, with permission attached to it, is refused before a byte is written and
  // before the notification service is touched.
  const transcript = await readTranscript(args.sessionId);
  const storedSnapshot = Array.isArray(existing.transcript_snapshot)
    ? (existing.transcript_snapshot as Array<{
        role?: string;
        message?: string;
        timestamp?: number | null;
        laAbsoluteTimestamp?: number | null;
      }>)
    : [];
  const proofRows = mergeLeadTranscriptHistory(
    storedSnapshot,
    transcript.snapshot.map((row) => ({
      role: row.role,
      message: row.message,
      laAbsoluteTimestamp: row.timestamp,
    })),
  );
  const qualification = evaluateIScottLeadSendQualification({
    fullName: existing.full_name,
    projectNeed: existing.project_need,
    contactMethod: existing.contact_method,
    contactValue: heldContact,
    requestedContactValue: args.contactMethod === "email" ? email : phone,
    consentStatus: existing.consent_status,
    contactConfirmedAt: existing.contact_confirmed_at,
    rows: proofRows,
  });
  if (!qualification.qualified) {
    throw new LeadNotQualifiedError({
      reason: qualification.blockers[0],
      blockers: qualification.blockers,
    });
  }

  // Normalized, for the same reason every other comparison here is. This one
  // guards the test-held short-circuit AND the submitted/outbox short-circuit
  // below: a re-formatted phone that reads as "not the same contact" walks
  // straight past both and mails Scott a lead he already has.
  const sameConfirmedContact = existing.contact_method === args.contactMethod && (
    args.contactMethod === "email"
      ? sameContactValue("email", existing.email, email)
      : sameContactValue("phone", existing.phone, phone)
  );
  // G 2026-08-19: a lead parked as test_held BEFORE owner sends were allowed has
  // to get a real send on the next confirm, or G still never sees the checkmark.
  // Only short-circuit when the gate is genuinely still shut for this row.
  const heldRowStillBlocked =
    existing.notification_status === ISCOTT_TEST_HELD_STATUS &&
    !canDispatchIScottLeadNotification({
      trafficClass: existing.traffic_class ?? null,
      visitorId: existing.anonymous_visitor_id ?? null,
      sessionId: args.sessionId,
      operatorQa: existing.metadata?.operator_qa === true,
    });
  if (heldRowStillBlocked && sameConfirmedContact) {
    return {
      lead: toState(existing),
      queued: true,
      delivered: false,
      detail: "test_traffic_not_sent",
    };
  }
  let failedLeadRetry: FailedLeadRetry | null = null;
  if (existing.status === "submitted" && existing.notification_outbox_id && sameConfirmedContact) {
    const outbox = await rest<LeadOutboxRow>(
      `voice_email_outbox?id=eq.${encodeURIComponent(existing.notification_outbox_id)}&select=id,status&limit=1`,
    );
    if (!outbox.ok) {
      throw new Error(`iscott outbox read failed (${outbox.status}): ${outbox.detail}`);
    }
    const row = outbox.rows[0];
    if (row) {
      if (row.status === "failed" || row.status === "dead_letter") {
        // A visible Retry is a deliberate visitor action, but it must stay the
        // SAME package. Re-arm the linked row with a status CAS; the normal
        // package-scoped notifier below will find this row by its existing
        // idempotency key, claim it with the outbox lease, and make one real
        // provider attempt. We keep attempt_count and the stored message intact
        // for auditability. A competing click can win this PATCH, but then the
        // notifier's claim CAS makes this request a harmless deduplicated read.
        const rearmed = await rest<LeadOutboxRow>(
          `voice_email_outbox?id=eq.${encodeURIComponent(row.id)}&status=eq.${encodeURIComponent(row.status)}&select=id,status`,
          {
            method: "PATCH",
            body: {
              status: "pending",
              last_error: null,
              lease_token: null,
              lease_expires_at: null,
              next_attempt_at: null,
              updated_at: new Date().toISOString(),
            },
            prefer: "return=representation",
          },
        );
        if (!rearmed.ok) {
          throw new Error(`iscott outbox retry failed (${rearmed.status}): ${rearmed.detail}`);
        }
        failedLeadRetry = {
          outboxId: row.id,
          submittedAt: existing.submitted_at,
        };
      } else {
        return {
          lead: toState(existing),
          queued: true,
          delivered: row.status === "sent",
          detail: row.status === "sent" ? "" : `voice_email_${row.status}`,
        };
      }
    }
  }

  // The confirmation timestamp is the one the conversation already earned. This
  // call never mints a fresh one.
  const now = existing.contact_confirmed_at;
  if (!now) throw new LeadNotQualifiedError({ reason: "contact_not_confirmed" });
  // G 2026-08-19: this flag still MARKS a lead as QA, but for owner sessions it no
  // longer blocks the send - see canDispatchIScottLeadNotification. Previously
  // "owner" plus a transcript full of dev phrases ("the box", "as soon as I say")
  // guaranteed a hold, so G's smoke tests could never reach a real checkmark.
  const operatorQa =
    existing.metadata?.operator_qa === true ||
    existing.traffic_class === "owner" ||
    existing.traffic_class === "test" ||
    existing.notification_status === ISCOTT_TEST_HELD_STATUS ||
    sessionLooksLikeOperatorQa(
      transcript.snapshot
        .filter((row) => row.role === "user")
        .map((row) => row.message),
    );
  const mayNotify = canDispatchIScottLeadNotification({
    trafficClass: existing.traffic_class ?? null,
    visitorId: existing.anonymous_visitor_id ?? null,
    sessionId: args.sessionId,
    operatorQa,
  });
  if (!mayNotify) {
    const held = await writeLead({
      ...existing,
      status: "confirmed",
      // Read, never written: the gate above proved this is already "accepted".
      consent_status: existing.consent_status,
      contact_method: args.contactMethod,
      email,
      phone,
      contact_confirmed_at: now,
      submitted_at: null,
      notification_outbox_id: null,
      notification_status: ISCOTT_TEST_HELD_STATUS,
      metadata: {
        ...(existing.metadata ?? {}),
        operator_qa: true,
      },
      updated_at: now,
    });
    return {
      lead: toState(held),
      queued: true,
      delivered: false,
      detail: "test_traffic_not_sent",
    };
  }

  let confirmed = await writeLead({
    ...existing,
    status: "confirmed",
    consent_status: existing.consent_status,
    contact_method: args.contactMethod,
    email,
    phone,
    contact_confirmed_at: now,
    updated_at: now,
  });

  const media = await readMedia(confirmed);
  const signedMedia = await Promise.all(media.map(async (item) => ({
    name: item.original_name ?? "Uploaded file",
    mimeType: item.mime_type,
    sizeBytes: item.size_bytes,
    signedUrl: await signMedia(item),
  })));
  const urls = dashboardUrls(args.sessionId);

  confirmed = await writeLead({
    ...confirmed,
    transcript_text: transcript.text,
    transcript_snapshot: transcript.snapshot,
    media_snapshot: media.map((item) => ({
      id: item.id,
      bucket: item.bucket,
      object_path: item.object_path,
      original_name: item.original_name,
      mime_type: item.mime_type,
      size_bytes: item.size_bytes,
      created_at: item.created_at,
    })),
    metadata: {
      ...(confirmed.metadata ?? {}),
      lead_dashboard_url: urls.lead,
      transcript_dashboard_url: urls.transcript,
    },
    updated_at: now,
  });

  const notification = await notifyIScottLeadByEmail({
    eventId: args.sessionId,
    sessionId: args.sessionId,
    fullName: confirmed.full_name,
    location: confirmed.location,
    projectNeed: confirmed.project_need,
    contactMethod: confirmed.contact_method,
    email: confirmed.email,
    phone: confirmed.phone,
    receivedAt: now,
    transcript: transcript.text,
    leadDashboardUrl: urls.lead,
    transcriptDashboardUrl: urls.transcript,
    media: signedMedia,
    metadata: {
      source: "iscott_liveavatar",
      mediaCount: media.length,
    },
  });

  if (
    failedLeadRetry &&
    notification.outboxId !== failedLeadRetry.outboxId
  ) {
    throw new Error("iscott retry changed owner outbox");
  }

  let visitorConfirmation: IScottVisitorConfirmationResult = {
    status: ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS,
    outboxId: null,
    idempotencyKey: null,
    packageVersionHash: null,
    recipient: null,
    providerAccepted: false,
    deduplicated: false,
    blockers: ["feature_not_authorized"],
  };
  // A retry does not mint a new package timestamp. Even if the provider rejects
  // this attempt, the same submitted package and its durable outbox remain the
  // truth the visitor can intentionally retry again.
  const submittedAt = failedLeadRetry
    ? failedLeadRetry.submittedAt
    : notification.queued
      ? now
      : null;
  const notificationStatus = notification.delivered
    ? "sent"
    : notification.outboxStatus === "failed"
      ? "failed"
      : notification.queued
        ? "queued"
        : "failed";
  const sentContactValue = confirmed.contact_method === "phone" ? confirmed.phone : confirmed.email;
  const finalRow = await writeLead({
    ...confirmed,
    // Stamp WHICH contact this package went to. Without it there is no way to
    // tell "this lead was sent" from "this contact was sent", and a later change
    // of method silently never travels.
    metadata: {
      ...(confirmed.metadata ?? {}),
      last_sent_contact: notification.queued ? sentContactValue : lastSentContact(confirmed.metadata),
    },
    status: failedLeadRetry ? "submitted" : notification.queued ? "submitted" : "confirmed",
    submitted_at: submittedAt,
    notification_outbox_id: notification.outboxId,
    notification_status: notificationStatus,
    updated_at: new Date().toISOString(),
  });

  // THE VISITOR RECEIPT IS BUILT FROM WHAT THE DATABASE SAYS, NOT FROM WHAT
  // THIS FUNCTION REMEMBERS, 2026-08-29.
  //
  // Everything above this line is about Scott's copy, and it is already durable
  // by now. A second, separately addressed message is a second decision, and it
  // is taken against a fresh read: the submitted row, and the conversation the
  // server itself stored. An in-memory `confirmed` could be a package a
  // concurrent write has already replaced, and a receipt sent to a mailbox the
  // visitor has since corrected goes to a stranger.
  //
  // While dispatch is unauthorized this block does not even read. The gate is
  // first so the disabled build makes no extra database round trip at all.
  if (
    ISCOTT_VISITOR_CONFIRMATION_ENABLED &&
    notification.queued &&
    notification.outboxId &&
    confirmed.contact_method === "email"
  ) {
    try {
      const reread = await readLead(args.sessionId);
      const rereadTranscript = await readTranscript(args.sessionId);
      const rereadSnapshot = Array.isArray(reread?.transcript_snapshot)
        ? (reread.transcript_snapshot as Array<{
            role?: string;
            message?: string;
            timestamp?: number | null;
            laAbsoluteTimestamp?: number | null;
          }>)
        : [];
      const rereadProof = mergeLeadTranscriptHistory(
        rereadSnapshot,
        rereadTranscript.snapshot.map((row) => ({
          role: row.role,
          message: row.message,
          laAbsoluteTimestamp: row.timestamp,
        })),
      );
      const visitorNotifier = voiceEmailNotifications.notifyIScottVisitorConfirmationByEmail;
      if (reread && typeof visitorNotifier === "function") {
        visitorConfirmation = await visitorNotifier({
          sessionId: args.sessionId,
          ownerNotificationOutboxId: notification.outboxId,
          // The mailbox Scott's package was addressed from. The gate refuses if
          // the stored row no longer agrees with it.
          sentEmail: sentContactValue,
          lead: {
            status: reread.status,
            submittedAt: reread.submitted_at,
            fullName: reread.full_name,
            projectNeed: reread.project_need,
            consentStatus: reread.consent_status,
            contactConfirmedAt: reread.contact_confirmed_at,
            contactMethod: reread.contact_method,
            email: reread.email,
          },
          proofRows: rereadProof,
        });
      }
    } catch {
      // The owner row above is already durable. Visitor failure cannot undo,
      // block, or relabel that owner handoff.
      visitorConfirmation = {
        status: "failed",
        outboxId: null,
        idempotencyKey: null,
        packageVersionHash: null,
        recipient: null,
        providerAccepted: false,
        deduplicated: false,
        blockers: [],
      };
    }
  }

  // Only an outcome that actually happened is recorded. "Waiting on G" and
  // "did not qualify" are the resting states this row already expresses through
  // the column default, and writing them on every submit would churn the lead
  // row for nothing.
  if (
    visitorConfirmation.status === "queued" ||
    visitorConfirmation.status === "provider_accepted" ||
    visitorConfirmation.status === "failed"
  ) {
    try {
      await writeLead({
        ...finalRow,
        visitor_confirmation_recipient: visitorConfirmation.recipient,
        visitor_confirmation_outbox_id: visitorConfirmation.outboxId,
        visitor_confirmation_idempotency_key: visitorConfirmation.idempotencyKey,
        visitor_confirmation_package_version_hash: visitorConfirmation.packageVersionHash,
        visitor_confirmation_status: visitorConfirmation.status,
        // Provider custody, timestamped. The inbox column beside it stays
        // untouched: nothing here is entitled to claim delivery.
        visitor_confirmation_provider_accepted_at: visitorConfirmation.providerAccepted
          ? new Date().toISOString()
          : null,
        visitor_confirmation_block_reason: visitorConfirmation.blockers[0] ?? null,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Owner notification is already durable. Optional visitor status is a
      // best-effort follow-up and never changes the owner result below.
    }
  }

  return {
    lead: toState(finalRow),
    queued: notification.queued,
    delivered: notification.delivered,
    detail: notification.detail,
  };
}
