import { visitorChoseContactMethod } from "./iscottLeadCaptureUi";
import { truncateUtf8String } from "./apiRouteSecurity";
import { notifyIScottLeadByEmail } from "./voiceEmailNotifications";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import {
  collectBargeInEvents,
  collectOperatorPromptEchoEvents,
  detectsAcceptedFollowUp,
  detectsContactReadBackCorrect,
  detectsContextualContactSendConfirmation,
  detectsFollowUpAcceptance,
  detectsSimpleAffirmation,
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
  isOperatorPromptEcho,
  isOperatorSalesLanguage,
  isProfanityEscalation,
  isSpecificFeedback,
  preferProjectNeed,
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
  if (!isSupabaseAdminConfigured()) {
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
    const data: unknown = response.ok ? await response.json().catch(() => []) : [];
    return {
      ok: response.ok,
      status: response.status,
      rows: Array.isArray(data) ? (data as T[]) : [],
      detail,
    };
  } catch (error) {
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

  for (const text of userTurnTexts(rows)) {
    const methodOnly = extractContactMethod(text);
    if (!shouldParseLeadFacts(text) && !isOperatorCorrection(text)) {
      if (methodOnly) contactMethod = methodOnly;
      continue;
    }
    fullName = preferLonger(fullName, extractFullName(text));
    location = extractLocation(text) ?? location;
    projectNeed = preferProjectNeed(projectNeed, extractProjectNeed(text));

    const previousEmail = email;
    const previousPhone = phone;
    const nextEmail = extractEmail(text);
    const nextPhone = extractPhone(text);
    email = nextEmail ?? email;
    phone = nextPhone ?? phone;
    contactMethod = methodOnly ?? contactMethod;

    const contactChanged =
      (nextEmail && previousEmail && nextEmail !== previousEmail) ||
      (nextPhone && previousPhone && nextPhone !== previousPhone);
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

  const currentContact = contactMethod === "email" ? email : contactMethod === "phone" ? phone : null;
  const isPostRolloutLead = !existing || Date.parse(existing.created_at) >= CONTEXTUAL_CONFIRMATION_INTRODUCED_AT;
  if (
    consentStatus !== "declined" &&
    contactMethod &&
    currentContact &&
    isPostRolloutLead &&
    detectsContextualContactSendConfirmation(rows, contactMethod, currentContact)
  ) {
    contactConfirmedAt = contactConfirmedAt ?? captureTime;
    consentStatus = "accepted";
  }

  const hasContact = Boolean(contactMethod === "phone" ? phone : contactMethod === "email" ? email : email || phone);
  let status: LeadRow["status"] = consentStatus === "declined"
    ? "declined"
    : hasContact
      ? "ready_for_confirmation"
      : "capturing";
  if (existing?.status === "confirmed" || existing?.status === "submitted") status = existing.status;

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
    submitted_at: existing?.submitted_at ?? null,
    notification_outbox_id: existing?.notification_outbox_id ?? null,
    notification_status: existing?.notification_status ?? null,
    ...trafficColumns(traffic),
    ...leadTranscriptFields(args.rows, existing),
    media_snapshot: existing?.media_snapshot ?? [],
    metadata: {
      ...(existing?.metadata ?? {}),
      last_capture_at: now,
      latest_user_timestamp: userRows.at(-1)?.laAbsoluteTimestamp ?? null,
      follow_up_accepted: detectsFollowUpAcceptance(rows),
      contact_readback_correct: userTexts.some((text) => detectsContactReadBackCorrect(text)),
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
        body: JSON.stringify({ expiresIn: 7 * 24 * 60 * 60 }),
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

  const sameConfirmedContact = existing.contact_method === args.contactMethod && (
    args.contactMethod === "email"
      ? existing.email === email
      : existing.phone === phone
  );
  if (existing.notification_status === ISCOTT_TEST_HELD_STATUS && sameConfirmedContact) {
    return {
      lead: toState(existing),
      queued: true,
      delivered: false,
      detail: "test_traffic_not_sent",
    };
  }
  if (existing.status === "submitted" && existing.notification_outbox_id && sameConfirmedContact) {
    const outbox = await rest<LeadOutboxRow>(
      `voice_email_outbox?id=eq.${encodeURIComponent(existing.notification_outbox_id)}&select=id,status&limit=1`,
    );
    if (!outbox.ok) {
      throw new Error(`iscott outbox read failed (${outbox.status}): ${outbox.detail}`);
    }
    const row = outbox.rows[0];
    if (row) {
      return {
        lead: toState(existing),
        queued: row.status !== "dead_letter",
        delivered: row.status === "sent",
        detail: row.status === "sent" ? "" : `voice_email_${row.status}`,
      };
    }
  }

  const now = existing.contact_confirmed_at ?? new Date().toISOString();
  const transcript = await readTranscript(args.sessionId);
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
      consent_status: "accepted",
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
    consent_status: "accepted",
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

  const submittedAt = notification.queued ? now : null;
  const finalRow = await writeLead({
    ...confirmed,
    status: notification.queued ? "submitted" : "confirmed",
    submitted_at: submittedAt,
    notification_outbox_id: notification.outboxId,
    notification_status: notification.delivered
      ? "sent"
      : notification.queued
        ? "queued"
        : "failed",
    updated_at: new Date().toISOString(),
  });

  return {
    lead: toState(finalRow),
    queued: notification.queued,
    delivered: notification.delivered,
    detail: notification.detail,
  };
}
