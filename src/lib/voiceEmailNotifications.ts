import { Resend } from "resend";
import { createHash, randomUUID } from "node:crypto";
import { truncateUtf8String } from "./apiRouteSecurity";
import {
  normalizedContactValue,
  summariseLeadQualification,
  visitorLinesFromTranscript,
} from "./iscottLeadParsing";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { queueSupabaseOperationalAlert } from "./wildworksOperationalAlerts";
import { safeJsonPayload } from "./telemetryServer";
import {
  isVoiceEmailOutboxRowDue,
  VOICE_EMAIL_OUTBOX_STALE_MS,
  voiceEmailConfigurationFailurePatch,
  voiceEmailRetryDelayMs,
} from "./voiceEmailOutboxPolicy";
import {
  voiceLeadEmailIdempotencyKey,
  voicemailEmailIdempotencyKey,
} from "./voiceNotificationIds";
import { voiceBackendSignal } from "./voiceFetchTimeouts";
import { wildWorksSenderConfigurationError } from "./wildworksEmailIdentity.mjs";
import {
  THEME as EMAIL_THEME,
  emailShell,
  emailSubheading,
  emailCallout,
  emailRows,
  emailButton,
  emailPre,
} from "./emailTheme";
import {
  ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS,
  ISCOTT_VISITOR_CONFIRMATION_ENABLED,
  IScottVisitorConfirmationArgs,
  IScottVisitorConfirmationBlocker,
  IScottVisitorConfirmationStatus,
  prepareIScottVisitorConfirmation,
} from "./iscottVisitorConfirmation";

export { isVoiceEmailOutboxRowDue, voiceEmailRetryDelayMs } from "./voiceEmailOutboxPolicy";
export { wildWorksSenderConfigurationError } from "./wildworksEmailIdentity.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JsonObject = Record<string, unknown>;
type VoiceEmailEventType =
  | "voice_lead"
  | "voicemail"
  | "iscott_lead"
  | "iscott_visitor_confirmation"
  | "telemetry_message"
  | "telemetry_digest";
type VoiceEmailStatus = "pending" | "sending" | "sent" | "failed";

export type VoiceEmailOutboxRow = {
  id: string;
  idempotency_key: string;
  event_type: VoiceEmailEventType;
  session_id: string | null;
  external_call_id: string | null;
  recipient: string | null;
  subject: string;
  text_body: string;
  html_body: string | null;
  status: VoiceEmailStatus;
  attempt_count: number;
  provider_message_id: string | null;
  updated_at: string;
  lease_token: string | null;
  lease_expires_at: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
};

const OUTBOX_SELECT = "id,idempotency_key,event_type,session_id,external_call_id,recipient,subject,text_body,html_body,status,attempt_count,provider_message_id,updated_at,lease_token,lease_expires_at,next_attempt_at,last_attempt_at";
const OUTBOX_LEASE_MS = 5 * 60 * 1000;
const RESEND_TIMEOUT_MS = 5_000;

type RestResult<T> = {
  ok: boolean;
  status: number;
  detail: string;
  rows: T[];
};

type VoiceEmailContent = {
  eventType: VoiceEmailEventType;
  idempotencyKey: string;
  // EXPLICIT, NEVER INFERRED, 2026-08-29. This field used to be optional, and
  // an absent recipient silently became the configured owner address. That is a
  // safe default for exactly one kind of mail and a disaster for any other: a
  // visitor-addressed message that lost its recipient anywhere along the way
  // would have been posted to Scott instead of failing. Every constructor now
  // names its own audience, and the compiler is what enforces it.
  recipient: string | null;
  sessionId?: string | null;
  externalCallId?: string | null;
  subject: string;
  text: string;
  html: string;
  metadata?: JsonObject;
  /**
   * Queue this one for later instead of sending it now. The drain already
   * selects on `next_attempt_at.is.null,next_attempt_at.lte.<now>`, so a future
   * value simply parks the row until it is due. Used by the partial-lead alert
   * so a conversation that finishes normally never produces two emails.
   */
  deferUntil?: string | null;
};

type VoiceNotificationBase = {
  eventId: string;
  sessionId?: string | null;
  externalCallId?: string | null;
  callerName?: string | null;
  callerPhone?: string | null;
  receivedAt?: Date | string;
  metadata?: JsonObject;
};

export type VoiceLeadEmailArgs = VoiceNotificationBase & {
  summary?: string | null;
};

export type VoicemailEmailArgs = VoiceNotificationBase & {
  voicemailText?: string | null;
  transcriptionStatus?: string | null;
  recordingReference?: string | null;
};

export type IScottLeadMediaEmailItem = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl: string | null;
};

export type IScottLeadEmailArgs = {
  eventId: string;
  sessionId: string;
  fullName?: string | null;
  location?: string | null;
  projectNeed?: string | null;
  contactMethod?: "email" | "phone" | null;
  email?: string | null;
  phone?: string | null;
  receivedAt?: Date | string;
  transcript?: string | null;
  leadDashboardUrl?: string | null;
  transcriptDashboardUrl?: string | null;
  media?: IScottLeadMediaEmailItem[];
  metadata?: JsonObject;
  // G, 2026-08-30: "all potential leads should be sent to me by email ...
  // any and all information, an email address, a phone number, anything."
  // 11 leads carrying a real email or phone had reached
  // ready_for_confirmation and were NEVER mailed to him - two of them public
  // visitors with Baltimore numbers. A partial is exactly that lead: it has a
  // way to reach somebody, and it did not finish. Labelled loudly and keyed
  // separately so it can never be mistaken for a completed handoff.
  partial?: boolean;
};

export type PublicMessageEmailArgs = {
  sessionId: string;
  anonymousVisitorId?: string | null;
  message: string;
  route?: string | null;
  receivedAt?: Date | string;
  location?: string | null;
  device?: string | null;
  metadata?: JsonObject;
  testOnly?: boolean;
  testId?: string | null;
};

export type TelemetryDigestEmailArgs = {
  digestDate: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  publicSessions: number;
  humanSignals: number;
  publicMessages: number;
  submittedLeads: number;
  failedNotifications: number;
  botSessions: number;
  testSessions: number;
  ownerSessions: number;
  topRoutes?: Array<{ route: string; count: number }>;
};

export type VoiceEmailNotificationResult = {
  ok: boolean;
  status: number;
  detail: string;
  outboxId: string | null;
  outboxStatus: VoiceEmailStatus | null;
  providerMessageId: string | null;
  queued: boolean;
  delivered: boolean;
  deduplicated: boolean;
};

// No "delivered" and no "inboxDelivered" field exists here on purpose. The only
// honest thing this pipeline can report is that the provider accepted custody.
export type IScottVisitorConfirmationResult = {
  status: IScottVisitorConfirmationStatus;
  outboxId: string | null;
  idempotencyKey: string | null;
  packageVersionHash: string | null;
  recipient: string | null;
  providerAccepted: boolean;
  deduplicated: boolean;
  blockers: IScottVisitorConfirmationBlocker[];
};

export type VoiceEmailDrainResult = {
  ok: boolean;
  status: number;
  detail: string;
  examined: number;
  claimed: number;
  delivered: number;
  failed: number;
  skipped: number;
};

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function cleanId(value: unknown, maxChars = 240): string | null {
  const cleaned = cleanText(value, maxChars);
  return cleaned && !/[\u0000-\u001f\u007f]/.test(cleaned) ? cleaned : null;
}

function cleanEmail(value: unknown): string | null {
  const email = cleanText(value, 254)?.toLowerCase() ?? null;
  return email && EMAIL_PATTERN.test(email) ? email : null;
}

function iScottLeadPackageIdempotencyKey(args: {
  eventId: string;
  contactMethod: "email" | "phone" | null;
  email: string | null;
  phone: string | null;
}): string {
  const contactMethod = args.contactMethod === "phone" ? "phone" : "email";
  const contactValue = contactMethod === "phone" ? args.phone : args.email;
  const normalizedContact = normalizedContactValue(contactMethod, contactValue);
  if (!normalizedContact) return `iscott-lead:${args.eventId}`;

  // The outbox key is durable and operator-visible. Hash the package identity so
  // it can dedupe the same verified contact without storing an email address or
  // phone number in the key itself. Including the event keeps two visitors who
  // happen to share a contact from collapsing into one notification.
  const packageDigest = createHash("sha256")
    .update(`${args.eventId}\u0000${contactMethod}\u0000${normalizedContact}`, "utf8")
    .digest("hex");
  return `iscott-lead-package:${packageDigest}`;
}

function notificationRecipient(): string | null {
  return cleanEmail(
    process.env.WILDWORKS_LEAD_NOTIFY_EMAIL ||
      process.env.WILDWORKS_VOICE_NOTIFY_EMAIL ||
      process.env.WILDWORKS_SIGNUP_NOTIFY_EMAIL ||
      "Scott@WildWorks.ai",
  );
}

function isoTimestamp(value: Date | string | undefined): string | null {
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function easternDateStamp(value: Date | string | undefined): string | null {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}${month}${day}` : null;
}

export function apparentInterest(message: string): "Landscaping" | "Website" | "Landscaping and Website" | "WildWorks Project" {
  const normalized = message.toLowerCase();
  const landscaping = /\b(landscap(?:e|es|ed|ing)|garden(?:s|ing)?|yard|backyard|patio|stonework|hardscap(?:e|ing)|plant(?:s|ing)?|drainage|grading|water feature)\b/.test(normalized);
  const website = /\b(website|web site|web design|brand(?:ing)?|logo)\b/.test(normalized);
  if (landscaping && website) return "Landscaping and Website";
  if (landscaping) return "Landscaping";
  if (website) return "Website";
  return "WildWorks Project";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function cleanMultiline(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\r\n?/g, "\n").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const candidate = cleanId(value, 2_000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function detailLine(label: string, value: string | null): { text: string; html: string } | null {
  if (!value) return null;
  return {
    text: `${label}: ${value}`,
    html: `<p style="margin:0 0 8px;font-size:14px;color:${EMAIL_THEME.text1}"><strong style="color:${EMAIL_THEME.text2};font-weight:700">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
  };
}

function secureLinkLine(label: string, value: string | null): { text: string; html: string } | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return detailLine(label, value);
    const escaped = escapeHtml(url.toString());
    return {
      text: `${label}: ${url.toString()}`,
      html: `<p style="margin:0 0 8px;font-size:14px;color:${EMAIL_THEME.text1}"><strong style="color:${EMAIL_THEME.text2};font-weight:700">${escapeHtml(label)}:</strong> <a href="${escaped}" style="color:${EMAIL_THEME.text1};font-weight:700;text-decoration:underline">Play recording</a></p>`,
    };
  } catch {
    return detailLine(label, value);
  }
}

function notificationBody(args: {
  heading: string;
  callerName: string | null;
  callerPhone: string | null;
  receivedAt: string | null;
  externalCallId: string | null;
  sessionId: string | null;
  bodyLabel?: string;
  body?: string | null;
  recordingReference?: string | null;
  recordingLabel?: string;
}): { text: string; html: string } {
  const details = [
    detailLine("Caller", args.callerName),
    detailLine("Callback number", args.callerPhone),
    detailLine("Received", args.receivedAt),
    detailLine("Call reference", args.externalCallId),
    detailLine("Session reference", args.sessionId),
    secureLinkLine(args.recordingLabel ?? "Recording reference", args.recordingReference ?? null),
  ].filter((line): line is { text: string; html: string } => Boolean(line));
  const bodyText = args.body && args.bodyLabel
    ? `\n${args.bodyLabel}:\n${args.body}`
    : "";
  const bodyHtml = args.body && args.bodyLabel
    ? `${emailSubheading(args.bodyLabel)}${emailPre(args.body)}`
    : "";
  return {
    text: [args.heading, ...details.map((line) => line.text)].join("\n") + bodyText,
    html: emailShell({
      title: args.heading,
      heading: args.heading,
      eyebrow: "WildWorks · iScott",
      bodyHtml: `${details.map((line) => line.html).join("")}${bodyHtml}`,
    }),
  };
}

async function supabaseRest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: JsonObject; prefer?: string },
): Promise<RestResult<T>> {
  const resource = path.split(/[?&/]/, 1)[0] || "voice-email-data";
  const operation = `${init.method} ${resource}`;
  if (!isSupabaseAdminConfigured()) {
    queueSupabaseOperationalAlert({ component: "voice email outbox", operation, failureKind: "configuration", correlationSource: `voice-email:${resource}:configuration` });
    return { ok: false, status: 0, detail: "supabase_not_configured", rows: [] };
  }
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: init.method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
      signal: voiceBackendSignal(),
    });
    if (!response.ok) {
      queueSupabaseOperationalAlert({ component: "voice email outbox", operation, statusCode: response.status, correlationSource: `voice-email:${resource}:${response.status}` });
      return {
        ok: false,
        status: response.status,
        detail: await response.text().catch(() => ""),
        rows: [],
      };
    }
    const body: unknown = await response.json().catch(() => []);
    return {
      ok: true,
      status: response.status,
      detail: "",
      rows: Array.isArray(body) ? (body as T[]) : [],
    };
  } catch (error) {
    queueSupabaseOperationalAlert({ component: "voice email outbox", operation, correlationSource: `voice-email:${resource}:connectivity` });
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : String(error),
      rows: [],
    };
  }
}

async function findOutboxRow(idempotencyKey: string): Promise<RestResult<VoiceEmailOutboxRow>> {
  return supabaseRest(
    `voice_email_outbox?select=${OUTBOX_SELECT}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
    { method: "GET" },
  );
}

async function patchOutboxRow(
  id: string,
  patch: JsonObject,
  filters: { status?: VoiceEmailStatus; updatedAt?: string; leaseToken?: string } = {},
): Promise<RestResult<VoiceEmailOutboxRow>> {
  const filter = [
    `id=eq.${encodeURIComponent(id)}`,
    ...(filters.status ? [`status=eq.${encodeURIComponent(filters.status)}`] : []),
    ...(filters.updatedAt ? [`updated_at=eq.${encodeURIComponent(filters.updatedAt)}`] : []),
    ...(filters.leaseToken ? [`lease_token=eq.${encodeURIComponent(filters.leaseToken)}`] : []),
  ].join("&");
  return supabaseRest(
    `voice_email_outbox?${filter}&select=${OUTBOX_SELECT}`,
    {
      method: "PATCH",
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  );
}

// A lead row records notification_status once, on the confirm path, and is left at
// "queued" when Resend does not accept the mail inline. Without this write-back a
// lead delivered on a later attempt stays "queued" forever: the watchdog keeps
// counting it as stuck and iScott keeps refusing to say the email went out.
// Best effort by design - the mail is already delivered, so a failure here must
// never fail the drain.
async function reconcileLeadNotificationStatus(outboxId: string): Promise<void> {
  await supabaseRest(
    `iscott_leads?notification_outbox_id=eq.${encodeURIComponent(outboxId)}&notification_status=in.(queued,failed)`,
    {
      method: "PATCH",
      body: { notification_status: "sent" },
      prefer: "return=minimal",
    },
  );
}

async function enqueueVoiceEmail(
  content: VoiceEmailContent,
): Promise<{ result: RestResult<VoiceEmailOutboxRow>; deduplicated: boolean }> {
  // Whatever the caller named, normalized. There is no fallback here any more:
  // an owner constructor passes the configured owner address itself, so a
  // missing recipient can only mean "we do not know who this is for", which
  // fails closed downstream instead of defaulting to Scott's inbox.
  const recipient = cleanEmail(content.recipient);
  const insert = await supabaseRest<VoiceEmailOutboxRow>(
    `voice_email_outbox?select=${OUTBOX_SELECT}`,
    {
      method: "POST",
      body: {
        idempotency_key: content.idempotencyKey,
        event_type: content.eventType,
        session_id: content.sessionId ?? null,
        external_call_id: content.externalCallId ?? null,
        recipient,
        subject: content.subject,
        text_body: content.text,
        html_body: content.html,
        payload: safeJsonPayload(content.metadata),
        next_attempt_at: content.deferUntil ?? null,
      },
      prefer: "return=representation",
    },
  );
  if (insert.ok) return { result: insert, deduplicated: false };
  if (insert.status !== 409) return { result: insert, deduplicated: false };

  const existing = await findOutboxRow(content.idempotencyKey);
  if (!existing.ok || !existing.rows[0]) return { result: existing, deduplicated: false };
  const row = existing.rows[0];
  const sameLogicalVoiceLead = content.eventType === "voice_lead" &&
    row.event_type === "voice_lead" &&
    Boolean(content.externalCallId) &&
    row.external_call_id === content.externalCallId;
  if (sameLogicalVoiceLead) {
    // Runtime session_end and Twilio's signed Connect action are independent
    // delivery paths for the same call. Whichever queues first wins.
    return { result: existing, deduplicated: true };
  }
  const sameLogicalTelemetryEvent =
    row.event_type === content.eventType &&
    (content.eventType === "telemetry_digest" || content.eventType === "telemetry_message");
  if (sameLogicalTelemetryEvent) {
    // These keys deliberately identify one logical event (one date or one
    // session's first public message). Recomputing the body must never send it
    // twice or turn a successful prior delivery into a conflict.
    return { result: existing, deduplicated: true };
  }
  const sameLogicalIScottPackage =
    content.eventType === "iscott_lead" &&
    row.event_type === "iscott_lead" &&
    row.session_id === (content.sessionId ?? null);
  if (sameLogicalIScottPackage) {
    // The contact package is already encoded in the privacy-safe key. A retry
    // may regenerate a later confirmation timestamp or a longer transcript;
    // those presentation changes do not create a second owner notification.
    return { result: existing, deduplicated: true };
  }
  const sameLogicalIScottVisitorConfirmation =
    content.eventType === "iscott_visitor_confirmation" &&
    row.event_type === "iscott_visitor_confirmation" &&
    row.session_id === (content.sessionId ?? null) &&
    row.recipient === recipient;
  if (sameLogicalIScottVisitorConfirmation) {
    return { result: existing, deduplicated: true };
  }
  if (
    row.event_type !== content.eventType ||
    row.session_id !== (content.sessionId ?? null) ||
    row.external_call_id !== (content.externalCallId ?? null) ||
    row.subject !== content.subject ||
    row.text_body !== content.text
  ) {
    return {
      result: { ok: false, status: 409, detail: "voice_email_idempotency_conflict", rows: [] },
      deduplicated: false,
    };
  }
  return { result: existing, deduplicated: true };
}

function outboxFailure(
  result: RestResult<VoiceEmailOutboxRow>,
): VoiceEmailNotificationResult {
  return {
    ok: false,
    status: result.status,
    detail: result.detail,
    outboxId: null,
    outboxStatus: null,
    providerMessageId: null,
    queued: false,
    delivered: false,
    deduplicated: false,
  };
}

function parsedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("voice_email_provider_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function claimOutboxRow(
  row: VoiceEmailOutboxRow,
  recipient: string,
  now = new Date(),
): Promise<{ result: RestResult<VoiceEmailOutboxRow>; leaseToken: string }> {
  const leaseToken = randomUUID();
  // A CLAIM MAY NOT RE-ADDRESS THE MAIL. The row's stored recipient is the
  // audience this message was written for; a retry hours later, under different
  // configuration, must still go there or not at all. The only write permitted
  // is backfilling a legacy row that never carried a recipient at all, and even
  // then only with the value storedOutboxRecipient already resolved for it.
  const recipientPatch = row.recipient === null || row.recipient === undefined
    ? { recipient }
    : {};
  const result = await patchOutboxRow(
    row.id,
    {
      status: "sending",
      ...recipientPatch,
      attempt_count: Math.max(0, row.attempt_count) + 1,
      last_error: null,
      last_attempt_at: now.toISOString(),
      lease_token: leaseToken,
      lease_expires_at: new Date(now.getTime() + OUTBOX_LEASE_MS).toISOString(),
      next_attempt_at: null,
    },
    { status: row.status, updatedAt: row.updated_at },
  );
  return { result, leaseToken };
}

async function sendClaimedOutboxRow(
  row: VoiceEmailOutboxRow,
  leaseToken: string,
): Promise<VoiceEmailNotificationResult> {
  const recipient = cleanEmail(row.recipient);
  const configurationError = wildWorksSenderConfigurationError();
  if (!recipient || configurationError) {
    const detail = !recipient
      ? "voice_email_recipient_not_configured"
      : configurationError!;
    const failed = await patchOutboxRow(
      row.id,
      voiceEmailConfigurationFailurePatch(row.attempt_count, detail),
      { status: "sending", leaseToken },
    );
    return {
      ok: false,
      status: failed.ok ? 503 : failed.status,
      detail: failed.ok ? detail : "voice_email_failure_update_failed",
      outboxId: row.id,
      outboxStatus: failed.ok ? "failed" : "sending",
      providerMessageId: null,
      queued: true,
      delivered: false,
      deduplicated: false,
    };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const send = await withTimeout(
      resend.emails.send(
        {
          from: process.env.RESEND_FROM_EMAIL!,
          to: recipient,
          subject: row.subject,
          text: row.text_body,
          ...(row.html_body ? { html: row.html_body } : {}),
        },
        { idempotencyKey: row.idempotency_key },
      ),
      RESEND_TIMEOUT_MS,
    );
    if (send.error) throw new Error("resend_send_failed");
    const providerMessageId = send.data?.id ?? null;
    const sent = await patchOutboxRow(
      row.id,
      {
        status: "sent",
        provider_message_id: providerMessageId,
        last_error: null,
        sent_at: new Date().toISOString(),
        lease_token: null,
        lease_expires_at: null,
        next_attempt_at: null,
      },
      { status: "sending", leaseToken },
    );
    if (!sent.ok || !sent.rows[0]) {
      return {
        ...outboxFailure(sent),
        detail: "voice_email_sent_outbox_update_failed",
        outboxId: row.id,
        outboxStatus: "sending",
        providerMessageId,
        queued: true,
        delivered: true,
        deduplicated: false,
      };
    }
    if (row.event_type === "iscott_lead") {
      await reconcileLeadNotificationStatus(row.id);
    }
    return {
      ok: true,
      status: 200,
      detail: "",
      outboxId: row.id,
      outboxStatus: "sent",
      providerMessageId,
      queued: true,
      delivered: true,
      deduplicated: false,
    };
  } catch {
    const nextAttemptAt = new Date(Date.now() + voiceEmailRetryDelayMs(row.attempt_count)).toISOString();
    const failed = await patchOutboxRow(
      row.id,
      {
        status: "failed",
        last_error: "resend_send_failed",
        lease_token: null,
        lease_expires_at: null,
        next_attempt_at: nextAttemptAt,
      },
      { status: "sending", leaseToken },
    );
    return {
      ok: false,
      status: failed.ok ? 502 : failed.status,
      detail: failed.ok ? "resend_send_failed" : "voice_email_failure_update_failed",
      outboxId: row.id,
      outboxStatus: failed.ok ? "failed" : "sending",
      providerMessageId: null,
      queued: true,
      delivered: false,
      deduplicated: false,
    };
  }
}

async function deliverVoiceEmail(
  content: VoiceEmailContent,
): Promise<VoiceEmailNotificationResult> {
  const queued = await enqueueVoiceEmail(content);
  if (!queued.result.ok || !queued.result.rows[0]) return outboxFailure(queued.result);
  const row = queued.result.rows[0];
  // DEFERRED: queued on purpose and deliberately not attempted here. The row is
  // parked until next_attempt_at and the drain picks it up then - by which time
  // a lead that went on to finish will have retired it (see
  // supersedePendingPartialLead below). Returning delivered:false is the honest
  // answer: nothing has been sent yet, and nothing about this row is a failure.
  if (content.deferUntil && row.status === "pending") {
    return {
      ok: true,
      status: queued.result.status,
      detail: "",
      outboxId: row.id,
      outboxStatus: row.status,
      providerMessageId: null,
      queued: true,
      delivered: false,
      deduplicated: queued.deduplicated,
    };
  }
  if (row.status === "sent") {
    return {
      ok: true,
      status: queued.result.status,
      detail: "",
      outboxId: row.id,
      outboxStatus: row.status,
      providerMessageId: row.provider_message_id,
      queued: true,
      delivered: true,
      deduplicated: true,
    };
  }

  // The outbox row owns its snapshotted recipient. This is essential for the
  // separately addressed visitor event and also prevents retry-time config
  // drift from redirecting an already-queued message. Legacy rows with no
  // recipient retain the old global fallback.
  const recipient = storedOutboxRecipient(row);
  const configurationError = wildWorksSenderConfigurationError();
  if (!recipient || configurationError) {
    const detail = !recipient
      ? "voice_email_recipient_not_configured"
      : configurationError!;
    const failed = row.status === "pending" || row.status === "failed"
      ? await patchOutboxRow(
          row.id,
          voiceEmailConfigurationFailurePatch(row.attempt_count, detail),
          { status: row.status, updatedAt: row.updated_at },
        )
      : null;
    const configurationFailureRecorded = Boolean(failed?.ok && failed.rows[0]);
    return {
      ok: true,
      status: 202,
      detail: failed === null || configurationFailureRecorded
        ? detail
        : "voice_email_failure_update_failed",
      outboxId: row.id,
      outboxStatus: configurationFailureRecorded ? "failed" : row.status,
      providerMessageId: row.provider_message_id,
      queued: true,
      delivered: false,
      deduplicated: queued.deduplicated,
    };
  }

  if (!isVoiceEmailOutboxRowDue(row)) {
    return {
      ok: true,
      status: 202,
      detail: "voice_email_already_claimed_or_waiting",
      outboxId: row.id,
      outboxStatus: row.status,
      providerMessageId: row.provider_message_id,
      queued: true,
      delivered: false,
      deduplicated: true,
    };
  }

  const claimed = await claimOutboxRow(row, recipient);
  if (!claimed.result.ok) return outboxFailure(claimed.result);
  const claimedRow = claimed.result.rows[0];
  if (!claimedRow) {
    const existing = await findOutboxRow(row.idempotency_key);
    if (!existing.ok || !existing.rows[0]) return outboxFailure(existing);
    return {
      ok: true,
      status: 202,
      detail: "voice_email_claim_lost",
      outboxId: existing.rows[0].id,
      outboxStatus: existing.rows[0].status,
      providerMessageId: existing.rows[0].provider_message_id,
      queued: true,
      delivered: existing.rows[0].status === "sent",
      deduplicated: true,
    };
  }
  const sent = await sendClaimedOutboxRow(claimedRow, claimed.leaseToken);
  return { ...sent, deduplicated: queued.deduplicated };
}

export async function drainVoiceEmailOutbox(
  options: { limit?: number } = {},
): Promise<VoiceEmailDrainResult> {
  const recipient = notificationRecipient();
  const configurationError = wildWorksSenderConfigurationError();
  if (!recipient || configurationError) {
    return {
      ok: false,
      status: 503,
      detail: !recipient
        ? "voice_email_recipient_not_configured"
        : configurationError!,
      examined: 0,
      claimed: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
    };
  }
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? 10)));
  const now = new Date();
  const nowFilter = encodeURIComponent(now.toISOString());
  const staleFilter = encodeURIComponent(new Date(now.getTime() - VOICE_EMAIL_OUTBOX_STALE_MS).toISOString());
  const dueRows = await supabaseRest<VoiceEmailOutboxRow>(
    `voice_email_outbox?select=${OUTBOX_SELECT}&status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.${nowFilter})&order=created_at.asc&limit=${limit}`,
    { method: "GET" },
  );
  if (!dueRows.ok) {
    return { ...dueRows, examined: 0, claimed: 0, delivered: 0, failed: 0, skipped: 0 };
  }
  const staleRows = await supabaseRest<VoiceEmailOutboxRow>(
    `voice_email_outbox?select=${OUTBOX_SELECT}&status=eq.sending&or=(lease_expires_at.is.null,lease_expires_at.lte.${nowFilter},updated_at.lte.${staleFilter})&order=updated_at.asc&limit=${limit}`,
    { method: "GET" },
  );
  if (!staleRows.ok) {
    return { ...staleRows, examined: dueRows.rows.length, claimed: 0, delivered: 0, failed: 0, skipped: 0 };
  }
  const candidates = [...dueRows.rows, ...staleRows.rows]
    .sort((a, b) => (parsedTime(a.updated_at) ?? 0) - (parsedTime(b.updated_at) ?? 0))
    .slice(0, limit);

  let claimedCount = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  const due = candidates.filter((row) => isVoiceEmailOutboxRowDue(row, now.getTime()));
  for (const row of due) {
    const rowRecipient = storedOutboxRecipient(row);
    if (!rowRecipient) {
      skipped += 1;
      continue;
    }
    const claimed = await claimOutboxRow(row, rowRecipient);
    if (!claimed.result.ok || !claimed.result.rows[0]) {
      skipped += 1;
      continue;
    }
    claimedCount += 1;
    const result = await sendClaimedOutboxRow(claimed.result.rows[0], claimed.leaseToken);
    if (result.delivered) delivered += 1;
    else failed += 1;
  }
  skipped += Math.max(0, candidates.length - due.length);
  return {
    ok: failed === 0,
    status: failed === 0 ? 200 : 207,
    detail: failed === 0 ? "" : "voice_email_partial_failure",
    examined: candidates.length,
    claimed: claimedCount,
    delivered,
    failed,
    skipped,
  };
}

export async function notifyVoiceLeadByEmail(
  args: VoiceLeadEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  const eventId = cleanId(args.eventId, 190);
  const receivedAt = isoTimestamp(args.receivedAt);
  if (!eventId || (args.receivedAt !== undefined && !receivedAt)) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_voice_lead_email", rows: [] });
  }
  const sessionId = cleanId(args.sessionId);
  const externalCallId = cleanId(args.externalCallId);
  const body = notificationBody({
    heading: "New WildWorks voice lead",
    callerName: cleanText(args.callerName, 180),
    callerPhone: cleanText(args.callerPhone, 80),
    receivedAt,
    externalCallId,
    sessionId,
    bodyLabel: "Conversation summary",
    body: cleanText(args.summary, 3000),
  });
  return deliverVoiceEmail({
    eventType: "voice_lead",
    // Owner notification: the configured owner address, named here rather than
    // inherited from a default buried in the enqueue.
    recipient: notificationRecipient(),
    idempotencyKey: voiceLeadEmailIdempotencyKey(eventId),
    sessionId,
    externalCallId,
    subject: "New WildWorks voice lead",
    ...body,
    metadata: args.metadata,
  });
}

export async function notifyVoicemailByEmail(
  args: VoicemailEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  const eventId = cleanId(args.eventId, 190);
  const receivedAt = isoTimestamp(args.receivedAt);
  if (!eventId || (args.receivedAt !== undefined && !receivedAt)) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_voicemail_email", rows: [] });
  }
  const sessionId = cleanId(args.sessionId);
  const externalCallId = cleanId(args.externalCallId);
  const voicemailText = cleanText(args.voicemailText, 4000);
  const transcriptionStatus = cleanText(args.transcriptionStatus, 500);
  const body = notificationBody({
    heading: "New WildWorks voicemail",
    callerName: cleanText(args.callerName, 180),
    callerPhone: cleanText(args.callerPhone, 80),
    receivedAt,
    externalCallId,
    sessionId,
    bodyLabel: voicemailText ? "Voicemail transcript" : "Transcription status",
    body: voicemailText ?? transcriptionStatus,
    recordingReference: cleanId(args.recordingReference),
    recordingLabel: "Secure recording playback",
  });
  return deliverVoiceEmail({
    eventType: "voicemail",
    recipient: notificationRecipient(),
    idempotencyKey: voicemailEmailIdempotencyKey(eventId),
    sessionId,
    externalCallId,
    subject: "New WildWorks voicemail",
    ...body,
    metadata: args.metadata,
  });
}

// A PARTIAL LEAD IS A DIFFERENT KIND OF MAIL, AND IT GETS ITS OWN DOOR.
//
// G, 2026-08-30, wants every scrap of contact detail to reach him even when
// the conversation collapsed. That directly contradicts a deliberate
// invariant this codebase already had - roughly twenty assertions across five
// test files say an UNQUALIFIED lead must never reach notifyIScottLeadByEmail,
// because that function means "a completed, consented handoff".
//
// Both things are correct, so they get separate functions. Everything the
// strict path protects stays protected and every one of those assertions is
// still true; this door only ever carries mail that is loudly labelled
// INCOMPLETE and keyed '#partial' so the outbox cannot confuse the two.
/**
 * How long an incomplete lead waits before it is mailed.
 *
 * G's ride adfdc2ff, 2026-08-31: the INCOMPLETE alert landed 65 seconds before
 * the real package for the SAME conversation, so one good lead produced two
 * emails. He had given his address; his name simply had not arrived yet.
 *
 * Ten minutes is longer than any capture sequence observed on a real ride and
 * short enough that a genuinely abandoned lead still reaches him while the
 * visitor might plausibly be re-contacted.
 */
const PARTIAL_LEAD_DELAY_MS = 10 * 60 * 1000;

const INCOMPLETE_SUBJECT_PREFIX = "INCOMPLETE iScott lead";

/**
 * Retire any still-pending incomplete alert for a session whose real package
 * has now gone. 'dead_letter' is one of the five statuses the table's CHECK
 * constraint allows - read off pg_constraint rather than assumed - and it means
 * exactly this: queued, will not be delivered, keep the row for the audit.
 *
 * Failure here is deliberately silent. The complete package has already
 * reached Scott, and a tidy-up that cannot run must never turn a delivered
 * lead into a reported failure.
 */
async function supersedePendingPartialLead(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    await supabaseRest<VoiceEmailOutboxRow>(
      `voice_email_outbox?session_id=eq.${encodeURIComponent(sessionId)}` +
        `&status=eq.pending&subject=like.${encodeURIComponent(INCOMPLETE_SUBJECT_PREFIX + "*")}`,
      {
        method: "PATCH",
        body: {
          status: "dead_letter",
          last_error: "superseded_by_complete_lead",
          next_attempt_at: null,
          lease_token: null,
          lease_expires_at: null,
        },
      },
    );
  } catch {
    // See above: never let the tidy-up mask a successful delivery.
  }
}

export async function notifyIScottPartialLeadByEmail(
  args: IScottLeadEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  return notifyIScottLeadByEmail({ ...args, partial: true });
}

export async function notifyIScottLeadByEmail(
  args: IScottLeadEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  const eventId = cleanId(args.eventId, 190);
  const sessionId = cleanId(args.sessionId);
  const receivedAt = isoTimestamp(args.receivedAt);
  if (!eventId || !sessionId || (args.receivedAt !== undefined && !receivedAt)) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_iscott_lead_email", rows: [] });
  }

  const fullName = cleanText(args.fullName, 180) ?? "Name not provided";
  const location = cleanText(args.location, 240);
  const projectNeed = cleanText(args.projectNeed, 2_000);
  const email = cleanEmail(args.email);
  const phone = cleanText(args.phone, 80);
  const contactMethod = args.contactMethod === "phone" ? "Phone call" : "Email";
  const transcript = cleanMultiline(args.transcript, 70_000) ?? "No transcript was available.";
  const leadDashboardUrl = safeHttpsUrl(args.leadDashboardUrl);
  const transcriptDashboardUrl = safeHttpsUrl(args.transcriptDashboardUrl);
  const media = (args.media ?? []).slice(0, 30).map((item) => ({
    name: cleanText(item.name, 240) ?? "Uploaded file",
    mimeType: cleanText(item.mimeType, 120) ?? "application/octet-stream",
    sizeBytes: Number.isFinite(item.sizeBytes) ? Math.max(0, Math.floor(item.sizeBytes)) : 0,
    signedUrl: safeHttpsUrl(item.signedUrl),
  }));

  // G, 2026-08-19, looking at a real lead in his inbox: "I need a summary first.
  // You know, I need all the information, name, project, preferred contact, all
  // that stuff... a hundred words or less, fifty words, a hundred words,
  // whatever. Whatever is important."
  //
  // Built from the stored fields, not from a model. Scott opens this on a phone
  // between jobs; it has to say who wants what and how to answer them before he
  // scrolls anything. Deterministic also means it cannot invent a job the
  // visitor never asked for.
  const summaryReach = [
    phone ? `phone ${phone}` : null,
    email ? `email ${email}` : null,
  ].filter(Boolean).join(" and ");
  const summaryPrefers = phone && email
    ? ` They gave both, and prefer ${args.contactMethod === "phone" ? "a phone call" : "email"}.`
    : "";
  const summaryMedia = media.length
    ? ` They uploaded ${media.length} file${media.length === 1 ? "" : "s"} - links below.`
    : "";
  const summaryWhere = location ? ` in ${location}` : "";
  const summaryWant = projectNeed
    ? `wants ${projectNeed.charAt(0).toLowerCase()}${projectNeed.slice(1)}`
    : "did not say what the project is yet";
  const summary =
    `${fullName}${summaryWhere} ${summaryWant}.` +
    (summaryReach ? ` Reach them on ${summaryReach}.${summaryPrefers}` : " No contact details were captured.") +
    summaryMedia +
    ` Confirmed ${receivedAt || "just now"}. Full conversation is behind Open Transcript.`;

  // G, 2026-08-19: "I definitely want to qualify leads... he can further probe
  // people with questions on how serious they are, and then you guys can put that
  // in the report."
  //
  // Read off the transcript, quoting the visitor. No score is invented: where
  // they said nothing, it says so. Scott is going to ring these people, and a
  // lead marked hot on a hunch wastes his afternoon worse than one marked
  // unknown honestly.
  const qual = summariseLeadQualification(
    visitorLinesFromTranscript(args.transcript ?? ""),
    { hasRealProject: Boolean(projectNeed) },
  );
  const READINESS_COPY: Record<string, string> = {
    ready: "READY NOW - they asked to get moving",
    planning: "PLANNING - real project, no date named",
    early: "EARLY - looking around, not ready",
    unknown: "NOT ESTABLISHED - iScott did not get a read",
  };
  const qualRows: Array<[string, string | null]> = [
    ["Readiness", READINESS_COPY[qual.readiness] ?? READINESS_COPY.unknown],
    ["Timeline", qual.timeline],
    ["Budget talk", qual.budget],
    ["Property", qual.ownership],
    ["Other contractors", qual.competing],
  ];
  const qualText = qualRows
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const qualTextBlock = `\n\nHOW SERIOUS\n${qualText}${qual.signals.length ? "" : "\nNothing else was said about timing, budget or ownership."}`;

  const subjectLocation = location ? ` — ${location}` : "";
  const isPartial = args.partial === true;
  const subject = truncateUtf8String(
    isPartial
      ? `INCOMPLETE iScott lead — ${fullName}${subjectLocation}`
      : `New iScott lead — ${fullName}${subjectLocation}`,
    220,
  );
  const detailsText = [
    "New confirmed iScott lead",
    `Name: ${fullName}`,
    location ? `Location: ${location}` : null,
    projectNeed ? `Project: ${projectNeed}` : null,
    `Preferred contact: ${contactMethod}`,
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
    receivedAt ? `Confirmed: ${receivedAt}` : null,
    `Session: ${sessionId}`,
    leadDashboardUrl ? `Complete lead: ${leadDashboardUrl}` : null,
    transcriptDashboardUrl ? `Transcript in Supabase: ${transcriptDashboardUrl}` : null,
  ].filter((line): line is string => Boolean(line));
  const mediaText = media.length
    ? `\n\nUPLOADED PHOTOS AND VIDEOS\n${media.map((item, index) =>
        `${index + 1}. ${item.name} (${item.mimeType}, ${item.sizeBytes} bytes)${item.signedUrl ? `\n   ${item.signedUrl}` : ""}`,
      ).join("\n")}`
    : "\n\nUPLOADED PHOTOS AND VIDEOS\nNone.";
  // Transcript is deliberately NOT inlined any more. G: "I shouldn't need the
  // full transcript in the email. That button open transcript, as long as it
  // works, is great." The dashboard link is still in the details above.
  const text = `SUMMARY\n${summary}${qualTextBlock}\n\n${detailsText.join("\n")}${mediaText}`;

  const detailRows = [
    ["Name", fullName],
    ["Location", location],
    ["Project", projectNeed],
    ["Preferred contact", contactMethod],
    ["Email", email],
    ["Phone", phone],
    ["Confirmed", receivedAt],
    ["Session", sessionId],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const linksHtml = [
    leadDashboardUrl
      ? emailButton(leadDashboardUrl, "Open Complete Lead in Supabase")
      : "",
    transcriptDashboardUrl
      ? emailButton(transcriptDashboardUrl, "Open Transcript")
      : "",
  ].join("");
  const mediaHtml = media.length
    ? media.map((item) => {
        const link = item.signedUrl
          ? `<a href="${escapeHtml(item.signedUrl)}" style="color:${EMAIL_THEME.text1};font-weight:700;text-decoration:underline">Open file</a>`
          : "Stored privately in Supabase";
        const preview = item.signedUrl && item.mimeType.startsWith("image/")
          ? `<div style="margin-top:8px"><a href="${escapeHtml(item.signedUrl)}"><img src="${escapeHtml(item.signedUrl)}" alt="${escapeHtml(item.name)}" style="display:block;max-width:100%;height:auto;border-radius:8px;border:1px solid ${EMAIL_THEME.text3}"></a></div>`
          : "";
        return `<li style="margin:0 0 16px;color:${EMAIL_THEME.text1}"><strong>${escapeHtml(item.name)}</strong><br><span style="color:${EMAIL_THEME.text2}">${escapeHtml(item.mimeType)} · ${item.sizeBytes.toLocaleString("en-US")} bytes</span><br>${link}${preview}</li>`;
      }).join("")
    : "<li>None.</li>";
  const qualLive = qualRows.filter(([, v]) => Boolean(v));
  const html = emailShell({
    title: "New Confirmed Lead",
    heading: "New Confirmed Lead",
    eyebrow: "WildWorks · iScott",
    maxWidth: 760,
    bodyHtml: [
      emailCallout({ label: "Summary", html: escapeHtml(summary) }),
      qualLive.length
        ? `<div style="margin:0 0 22px;padding:16px 18px;background:${EMAIL_THEME.pageBg};border:1px solid ${EMAIL_THEME.text3};border-radius:8px"><p style="margin:0 0 10px;color:${EMAIL_THEME.text2};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">How serious</p>${emailRows(qualLive as Array<[string, string | null | undefined]>)}</div>`
        : "",
      emailRows(detailRows as Array<[string, string | null | undefined]>),
      linksHtml,
      emailSubheading("Photos, Videos and Files"),
      `<ol style="padding-left:22px;color:${EMAIL_THEME.text1}">${mediaHtml}</ol>`,
    ].join(""),
  });

  const delivery = await deliverVoiceEmail({
    eventType: "iscott_lead",
    // Scott's own copy. The visitor receipt is a separate event with its own
    // address; this constructor never learns the visitor's mailbox as a
    // recipient, only as a detail line in the package it hands him.
    recipient: notificationRecipient(),
    idempotencyKey: iScottLeadPackageIdempotencyKey({
      eventId,
      contactMethod: args.contactMethod ?? null,
      email,
      phone,
    }),
    sessionId,
    subject,
    text,
    html,
    // An incomplete alert is PARKED, not sent. It only becomes mail if the
    // conversation never produces a real package - see PARTIAL_LEAD_DELAY_MS.
    deferUntil: isPartial
      ? new Date(Date.now() + PARTIAL_LEAD_DELAY_MS).toISOString()
      : null,
    metadata: {
      ...args.metadata,
      fullName,
      location,
      contactMethod: args.contactMethod ?? null,
      email,
      phone,
      mediaCount: media.length,
      partial: isPartial,
    },
  });

  // The real package went. Retire the incomplete alert for this session if one
  // is still waiting, so a lead that finished normally mails Scott exactly once.
  if (!isPartial && delivery.ok) await supersedePendingPartialLead(sessionId);

  return delivery;
}

async function notifyIScottVisitorConfirmationByEmailWithGate(
  args: IScottVisitorConfirmationArgs,
  enabled: boolean,
): Promise<IScottVisitorConfirmationResult> {
  // THE UNAUTHORIZED PATH TOUCHES NOTHING. No eligibility read, no Supabase
  // request, no provider client. Turning the constant on is the whole
  // activation, and until G makes that call this function is inert.
  if (!enabled) {
    return {
      status: ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS,
      outboxId: null,
      idempotencyKey: null,
      packageVersionHash: null,
      recipient: null,
      providerAccepted: false,
      deduplicated: false,
      blockers: ["feature_not_authorized"],
    };
  }
  const decision = prepareIScottVisitorConfirmation(args);
  if (!decision.eligible || !decision.prepared) {
    return {
      status: "blocked",
      outboxId: null,
      idempotencyKey: null,
      packageVersionHash: decision.packageVersionHash,
      recipient: decision.recipient,
      providerAccepted: false,
      deduplicated: false,
      blockers: decision.blockers,
    };
  }
  const prepared = decision.prepared;
  try {
    const notification = await deliverVoiceEmail({
      eventType: prepared.eventType,
      idempotencyKey: prepared.idempotencyKey,
      recipient: prepared.recipient,
      sessionId: prepared.sessionId,
      subject: prepared.subject,
      text: prepared.text,
      html: prepared.html,
      // The payload is as free of personal data as the key is: a version hash
      // identifies the package, and nothing here restates it.
      metadata: {
        source: "iscott_visitor_confirmation",
        packageVersionHash: prepared.packageVersionHash,
      },
    });
    // `notification.delivered` is the outbox's word for "the provider took it".
    // It is renamed here, once, so no caller downstream can read a claim about
    // an inbox out of it.
    const providerAccepted = notification.delivered;
    const status: IScottVisitorConfirmationStatus = providerAccepted
      ? "provider_accepted"
      : notification.outboxStatus === "pending" || notification.outboxStatus === "sending"
        ? "queued"
        : "failed";
    return {
      status,
      outboxId: notification.outboxId,
      idempotencyKey: prepared.idempotencyKey,
      packageVersionHash: prepared.packageVersionHash,
      recipient: prepared.recipient,
      providerAccepted,
      deduplicated: notification.deduplicated,
      blockers: [],
    };
  } catch {
    return {
      status: "failed",
      outboxId: null,
      idempotencyKey: prepared.idempotencyKey,
      packageVersionHash: prepared.packageVersionHash,
      recipient: prepared.recipient,
      providerAccepted: false,
      deduplicated: false,
      blockers: [],
    };
  }
}

export async function notifyIScottVisitorConfirmationByEmail(
  args: IScottVisitorConfirmationArgs,
): Promise<IScottVisitorConfirmationResult> {
  return notifyIScottVisitorConfirmationByEmailWithGate(
    args,
    ISCOTT_VISITOR_CONFIRMATION_ENABLED,
  );
}

function storedOutboxRecipient(row: Pick<VoiceEmailOutboxRow, "recipient">): string | null {
  // Null is the only legacy shape that may use the configured owner fallback.
  // A present-but-invalid recipient fails closed instead of being redirected
  // to the owner during inline send or retry drain.
  return row.recipient === null || row.recipient === undefined
    ? notificationRecipient()
    : cleanEmail(row.recipient);
}

export async function notifyFirstPublicMessageByEmail(
  args: PublicMessageEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  const sessionId = cleanId(args.sessionId);
  const message = cleanMultiline(args.message, 4_000);
  const receivedAt = isoTimestamp(args.receivedAt);
  if (!sessionId || !message || (args.receivedAt !== undefined && !receivedAt)) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_public_message_email", rows: [] });
  }
  const route = cleanText(args.route, 180);
  const location = cleanText(args.location, 240);
  const device = cleanText(args.device, 240);
  const visitor = cleanId(args.anonymousVisitorId, 160);
  const testId = args.testOnly ? cleanId(args.testId, 120) : null;
  if (args.testOnly && !testId) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_public_message_email_test", rows: [] });
  }
  const interest = apparentInterest(message);
  const easternDate = easternDateStamp(args.receivedAt);
  if (!easternDate) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_public_message_email_date", rows: [] });
  }
  const details = [
    testId ? "TEST ONLY — controlled notification smoke; not visitor traffic." : null,
    "First meaningful public iScott message",
    `Apparent interest: ${interest}`,
    receivedAt ? `Received: ${receivedAt}` : null,
    route ? `Route: ${route}` : null,
    location ? `Approximate location: ${location}` : null,
    device ? `Device: ${device}` : null,
    `Session: ${sessionId}`,
    visitor ? `Anonymous visitor: ${visitor}` : null,
    "",
    message,
  ].filter((line): line is string => line !== null).join("\n");
  const html = emailShell({
    title: "VIP iScott Message",
    heading: "VIP iScott Message",
    eyebrow: "WildWorks · iScott",
    bodyHtml: [
      testId
        ? emailCallout({ label: "Test only", html: "Controlled notification smoke; not visitor traffic." })
        : "",
      emailRows([
        ["Apparent interest", interest],
        ["Session", sessionId],
        ["Received", receivedAt],
        ["Route", route],
        ["Approximate location", location],
        ["Device", device],
      ]),
      emailPre(message),
    ].join(""),
  });
  return deliverVoiceEmail({
    eventType: "telemetry_message",
    recipient: notificationRecipient(),
    idempotencyKey: testId ? `telemetry-message:test:${testId}` : `telemetry-message:first:${sessionId}`,
    sessionId,
    subject: `${testId ? "TEST " : ""}VIP iScott ${easternDate} — ${interest}`,
    text: details,
    html,
    metadata: { ...args.metadata, anonymousVisitorId: visitor, route, location, device, testOnly: Boolean(testId) },
  });
}

export async function notifyTelemetryDigestByEmail(
  args: TelemetryDigestEmailArgs,
): Promise<VoiceEmailNotificationResult> {
  const digestDate = cleanText(args.digestDate, 20);
  const periodStart = isoTimestamp(args.periodStart);
  const periodEnd = isoTimestamp(args.periodEnd);
  if (!digestDate || !periodStart || !periodEnd) {
    return outboxFailure({ ok: false, status: 0, detail: "invalid_telemetry_digest_email", rows: [] });
  }
  const topRoutes = (args.topRoutes ?? []).slice(0, 8);
  const lines = [
    `WildWorks visitor digest for ${digestDate}`,
    `Period: ${periodStart} through ${periodEnd}`,
    "",
    `Public browser profiles with human signals: ${args.humanSignals}`,
    `Public iScott messages: ${args.publicMessages}`,
    `Submitted leads: ${args.submittedLeads}`,
    `Failed notifications: ${args.failedNotifications}`,
    `Unverified public browser profiles (background traffic included): ${args.publicSessions}`,
    `Owner sessions excluded: ${args.ownerSessions}`,
    `Test sessions excluded: ${args.testSessions}`,
    `Bot sessions excluded: ${args.botSessions}`,
    ...(topRoutes.length ? ["", "Top public routes:", ...topRoutes.map((item) => `- ${item.route}: ${item.count}`)] : []),
  ];
  const html = emailShell({
    title: "WildWorks Visitor Digest",
    heading: "WildWorks Visitor Digest",
    eyebrow: "WildWorks · iScott",
    bodyHtml: emailPre(lines.join("\n")),
  });
  return deliverVoiceEmail({
    eventType: "telemetry_digest",
    recipient: notificationRecipient(),
    idempotencyKey: `telemetry-digest:${digestDate}`,
    subject: `WildWorks visitor digest — ${digestDate}`,
    text: lines.join("\n"),
    html,
    metadata: safeJsonPayload(args),
  });
}
