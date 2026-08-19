import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { truncateUtf8String } from "./apiRouteSecurity";
import { summariseLeadQualification, visitorLinesFromTranscript } from "./iscottLeadParsing";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
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

export { isVoiceEmailOutboxRowDue, voiceEmailRetryDelayMs } from "./voiceEmailOutboxPolicy";
export { wildWorksSenderConfigurationError } from "./wildworksEmailIdentity.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JsonObject = Record<string, unknown>;
type VoiceEmailEventType =
  | "voice_lead"
  | "voicemail"
  | "iscott_lead"
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
  sessionId?: string | null;
  externalCallId?: string | null;
  subject: string;
  text: string;
  html: string;
  metadata?: JsonObject;
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
    html: `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
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
      html: `<p><strong>${escapeHtml(label)}:</strong> <a href="${escaped}">Play recording</a></p>`,
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
    ? `<h3>${escapeHtml(args.bodyLabel)}</h3><p style="white-space:pre-wrap">${escapeHtml(args.body)}</p>`
    : "";
  return {
    text: [args.heading, ...details.map((line) => line.text)].join("\n") + bodyText,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>${escapeHtml(args.heading)}</h2>${details.map((line) => line.html).join("")}${bodyHtml}</div>`,
  };
}

async function supabaseRest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: JsonObject; prefer?: string },
): Promise<RestResult<T>> {
  if (!isSupabaseAdminConfigured()) {
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
  const recipient = notificationRecipient();
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
  const result = await patchOutboxRow(
    row.id,
    {
      status: "sending",
      recipient,
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
    await reconcileLeadNotificationStatus(row.id);
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

  const recipient = notificationRecipient();
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
    const claimed = await claimOutboxRow(row, recipient);
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
    idempotencyKey: voicemailEmailIdempotencyKey(eventId),
    sessionId,
    externalCallId,
    subject: "New WildWorks voicemail",
    ...body,
    metadata: args.metadata,
  });
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
  const qual = summariseLeadQualification(visitorLinesFromTranscript(args.transcript ?? ""));
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
  const subject = truncateUtf8String(`New iScott lead — ${fullName}${subjectLocation}`, 220);
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
      ? `<a href="${escapeHtml(leadDashboardUrl)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 16px;border-radius:7px;background:#9a461c;color:#fff7df;text-decoration:none;font-weight:700">Open Complete Lead in Supabase</a>`
      : "",
    transcriptDashboardUrl
      ? `<a href="${escapeHtml(transcriptDashboardUrl)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 16px;border-radius:7px;background:#6d3012;color:#fff7df;text-decoration:none;font-weight:700">Open Transcript</a>`
      : "",
  ].join("");
  const mediaHtml = media.length
    ? media.map((item) => {
        const link = item.signedUrl
          ? `<a href="${escapeHtml(item.signedUrl)}" style="color:#8d3e18;font-weight:700">Open file</a>`
          : "Stored privately in Supabase";
        const preview = item.signedUrl && item.mimeType.startsWith("image/")
          ? `<div style="margin-top:8px"><a href="${escapeHtml(item.signedUrl)}"><img src="${escapeHtml(item.signedUrl)}" alt="${escapeHtml(item.name)}" style="display:block;max-width:100%;height:auto;border-radius:8px;border:1px solid #e2c18b"></a></div>`
          : "";
        return `<li style="margin:0 0 16px"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#6d5a49">${escapeHtml(item.mimeType)} · ${item.sizeBytes.toLocaleString("en-US")} bytes</span><br>${link}${preview}</li>`;
      }).join("")
    : "<li>None.</li>";
  const html = `<!doctype html><html><body style="margin:0;background:#f6ead5;color:#35180a;font-family:Arial,sans-serif"><div style="max-width:760px;margin:0 auto;padding:28px"><div style="background:#fffaf0;border:1px solid #d2a667;border-radius:12px;padding:26px"><p style="margin:0 0 6px;color:#a44b20;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">WildWorks · iScott</p><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:28px;color:#6f2f12">New Confirmed Lead</h1><div style="margin:0 0 22px;padding:16px 18px;background:#f9edd6;border-left:4px solid #a44b20;border-radius:8px"><p style="margin:0 0 6px;color:#a44b20;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Summary</p><p style="margin:0;font-size:15px;line-height:1.55;color:#4a2410">${escapeHtml(summary)}</p></div>${qualRows.filter(([, v]) => Boolean(v)).length ? `<div style="margin:0 0 22px;padding:16px 18px;background:#fff4e2;border:1px solid #e2c18b;border-radius:8px"><p style="margin:0 0 10px;color:#a44b20;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">How serious</p><table style="width:100%;border-collapse:collapse">${qualRows.filter(([, v]) => Boolean(v)).map(([label, value]) => `<tr><td style="width:150px;padding:5px 12px 5px 0;color:#75583e;vertical-align:top">${escapeHtml(label)}</td><td style="padding:5px 0;font-weight:600;white-space:pre-wrap">${escapeHtml(String(value))}</td></tr>`).join("")}</table></div>` : ""}<table style="width:100%;border-collapse:collapse;margin-bottom:20px">${detailRows.map(([label, value]) => `<tr><td style="width:150px;padding:7px 12px 7px 0;color:#75583e;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;font-weight:650;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table>${linksHtml}<h2 style="margin:24px 0 10px;font-family:Georgia,serif;color:#6f2f12">Photos, Videos and Files</h2><ol style="padding-left:22px">${mediaHtml}</ol></div></div></body></html>`;

  return deliverVoiceEmail({
    eventType: "iscott_lead",
    idempotencyKey: `iscott-lead:${eventId}`,
    sessionId,
    subject,
    text,
    html,
    metadata: {
      ...args.metadata,
      fullName,
      location,
      contactMethod: args.contactMethod ?? null,
      email,
      phone,
      mediaCount: media.length,
    },
  });
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
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#35180a;background:#f6ead5"><div style="max-width:720px;margin:auto;padding:24px"><div style="background:#fffaf0;border:1px solid #d2a667;border-radius:12px;padding:24px">${testId ? '<p style="margin:0 0 12px;color:#a44b20;font-weight:800">TEST ONLY — controlled notification smoke; not visitor traffic.</p>' : ""}<h1 style="font-family:Georgia,serif;color:#6f2f12">VIP iScott Message</h1><p><strong>Apparent interest:</strong> ${escapeHtml(interest)}</p><p><strong>Session:</strong> ${escapeHtml(sessionId)}</p>${receivedAt ? `<p><strong>Received:</strong> ${escapeHtml(receivedAt)}</p>` : ""}${route ? `<p><strong>Route:</strong> ${escapeHtml(route)}</p>` : ""}${location ? `<p><strong>Approximate location:</strong> ${escapeHtml(location)}</p>` : ""}${device ? `<p><strong>Device:</strong> ${escapeHtml(device)}</p>` : ""}<div style="white-space:pre-wrap;background:#f4e2c2;border-radius:8px;padding:16px">${escapeHtml(message)}</div></div></div></body></html>`;
  return deliverVoiceEmail({
    eventType: "telemetry_message",
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
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#35180a;background:#f6ead5"><div style="max-width:720px;margin:auto;padding:24px"><div style="background:#fffaf0;border:1px solid #d2a667;border-radius:12px;padding:24px"><h1 style="font-family:Georgia,serif;color:#6f2f12">WildWorks Visitor Digest</h1><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(lines.join("\n"))}</pre></div></div></body></html>`;
  return deliverVoiceEmail({
    eventType: "telemetry_digest",
    idempotencyKey: `telemetry-digest:${digestDate}`,
    subject: `WildWorks visitor digest — ${digestDate}`,
    text: lines.join("\n"),
    html,
    metadata: safeJsonPayload(args),
  });
}
