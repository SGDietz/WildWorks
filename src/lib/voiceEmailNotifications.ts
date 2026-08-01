import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { truncateUtf8String } from "./apiRouteSecurity";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { safeJsonPayload } from "./telemetryServer";
import {
  isVoiceEmailOutboxRowDue,
  VOICE_EMAIL_OUTBOX_STALE_MS,
  voiceEmailRetryDelayMs,
} from "./voiceEmailOutboxPolicy";
import {
  voiceLeadEmailIdempotencyKey,
  voicemailEmailIdempotencyKey,
} from "./voiceNotificationIds";
import { voiceBackendSignal } from "./voiceFetchTimeouts";

export { isVoiceEmailOutboxRowDue, voiceEmailRetryDelayMs } from "./voiceEmailOutboxPolicy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JsonObject = Record<string, unknown>;
type VoiceEmailEventType = "voice_lead" | "voicemail";
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
    process.env.WILDWORKS_VOICE_NOTIFY_EMAIL ||
      process.env.WILDWORKS_SIGNUP_NOTIFY_EMAIL,
  );
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function isoTimestamp(value: Date | string | undefined): string | null {
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  if (!recipient || !resendConfigured()) {
    return {
      ok: false,
      status: 503,
      detail: !recipient ? "voice_email_recipient_not_configured" : "resend_not_configured",
      outboxId: row.id,
      outboxStatus: "sending",
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
  if (!recipient || !resendConfigured()) {
    return {
      ok: true,
      status: 202,
      detail: !recipient ? "voice_email_recipient_not_configured" : "resend_not_configured",
      outboxId: row.id,
      outboxStatus: row.status,
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
  if (!recipient || !resendConfigured()) {
    return {
      ok: false,
      status: 503,
      detail: !recipient ? "voice_email_recipient_not_configured" : "resend_not_configured",
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
