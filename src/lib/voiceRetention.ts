import { randomUUID, timingSafeEqual } from "node:crypto";

const ACCOUNT_SID_PATTERN = /^AC[0-9a-fA-F]{32}$/;
const API_KEY_SID_PATTERN = /^SK[0-9a-fA-F]{32}$/;
const CALL_SID_PATTERN = /^CA[0-9a-fA-F]{32}$/;
const RECORDING_SID_PATTERN = /^RE[0-9a-fA-F]{32}$/;
const MIN_SECRET_BYTES = 32;
const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 25;
const TWILIO_DELETE_TIMEOUT_MS = 8_000;
const TWILIO_DELETE_CONCURRENCY = 4;

type JsonObject = Record<string, unknown>;

function getRetentionSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey
    ? { url: url.replace(/\/$/, ""), serviceRoleKey }
    : null;
}

export type VoiceRecordingPurgeClaim = {
  call_sid: string;
  recording_sid: string;
};

export type VoiceRetentionSummary = {
  messages_deleted: number;
  sessions_deleted: number;
  caller_contexts_deleted: number;
  sent_outbox_scrubbed: number;
  outbox_dead_lettered: number;
  outbox_alerts_24h_marked: number;
  outbox_alerts_7d_marked: number;
};

export type VoiceRetentionPreview = {
  recordings_due: number;
  caller_contexts_due: number;
  voice_messages_due: number;
  voice_sessions_due: number;
  sent_outbox_scrub_due: number;
  outbox_alert_24h_due: number;
  outbox_alert_7d_due: number;
  outbox_dead_letter_due: number;
};

type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: string };

export type TwilioRecordingDeleteResult =
  | { ok: true; alreadyAbsent: boolean }
  | { ok: false; errorCode: string };

export type VoiceRetentionExecutionResult = {
  ok: boolean;
  dryRun: boolean;
  claimed: number;
  recordingsDeleted: number;
  recordingsAlreadyAbsent: number;
  recordingDeleteFailures: number;
  recordingFinalizeFailures: number;
  databaseCleanup: VoiceRetentionSummary | null;
  preview: VoiceRetentionPreview | null;
  errorCodes: string[];
};

export type VoiceRetentionDependencies = {
  claimRecordings: (
    leaseToken: string,
    limit: number,
    now: Date,
  ) => Promise<OperationResult<VoiceRecordingPurgeClaim[]>>;
  completeRecording: (
    claim: VoiceRecordingPurgeClaim,
    leaseToken: string,
    now: Date,
  ) => Promise<OperationResult<boolean>>;
  failRecording: (
    claim: VoiceRecordingPurgeClaim,
    leaseToken: string,
    errorCode: string,
    now: Date,
  ) => Promise<OperationResult<boolean>>;
  deleteRecording: (recordingSid: string) => Promise<TwilioRecordingDeleteResult>;
  runDatabaseCleanup: (
    limit: number,
    now: Date,
  ) => Promise<OperationResult<VoiceRetentionSummary>>;
  previewDatabaseCleanup: (now: Date) => Promise<OperationResult<VoiceRetentionPreview>>;
  randomToken: () => string;
};

const SUMMARY_KEYS = [
  "messages_deleted",
  "sessions_deleted",
  "caller_contexts_deleted",
  "sent_outbox_scrubbed",
  "outbox_dead_lettered",
  "outbox_alerts_24h_marked",
  "outbox_alerts_7d_marked",
] as const;

const PREVIEW_KEYS = [
  "recordings_due",
  "caller_contexts_due",
  "voice_messages_due",
  "voice_sessions_due",
  "sent_outbox_scrub_due",
  "outbox_alert_24h_due",
  "outbox_alert_7d_due",
  "outbox_dead_letter_due",
] as const;

function safeEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function authorizeVoiceRetentionRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) return false;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return Boolean(supplied) && safeEqual(secret, supplied);
}

export function isVoiceRetentionEnabled(): boolean {
  return process.env.WILDWORKS_VOICE_RETENTION_ENABLED?.trim().toLowerCase() === "true";
}

export function isVoiceRetentionDryRun(request: Request): boolean {
  const forced = process.env.WILDWORKS_VOICE_RETENTION_DRY_RUN?.trim().toLowerCase() === "true";
  if (forced) return true;
  try {
    const value = new URL(request.url).searchParams.get("dryRun")?.trim().toLowerCase();
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export function voiceRetentionBatchLimit(): number {
  const configured = Number(process.env.WILDWORKS_VOICE_RETENTION_BATCH_LIMIT);
  if (!Number.isFinite(configured)) return DEFAULT_BATCH_LIMIT;
  return Math.min(MAX_BATCH_LIMIT, Math.max(1, Math.floor(configured)));
}

function normalizedCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function normalizedRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function normalizeSummary(value: unknown): VoiceRetentionSummary {
  const record = normalizedRecord(value);
  return Object.fromEntries(
    SUMMARY_KEYS.map((key) => [key, normalizedCount(record[key])]),
  ) as VoiceRetentionSummary;
}

function normalizePreview(value: unknown): VoiceRetentionPreview {
  const record = normalizedRecord(value);
  return Object.fromEntries(
    PREVIEW_KEYS.map((key) => [key, normalizedCount(record[key])]),
  ) as VoiceRetentionPreview;
}

async function supabaseRpc<T>(name: string, body: JsonObject): Promise<OperationResult<T>> {
  const config = getRetentionSupabaseConfig();
  if (!config) {
    return { ok: false, errorCode: "supabase_not_configured" };
  }
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return { ok: false, errorCode: `supabase_rpc_${response.status}` };
    }
    const value = await response.json().catch(() => null) as T;
    return { ok: true, value };
  } catch {
    return { ok: false, errorCode: "supabase_rpc_unavailable" };
  }
}

async function claimRecordings(
  leaseToken: string,
  limit: number,
  now: Date,
): Promise<OperationResult<VoiceRecordingPurgeClaim[]>> {
  const result = await supabaseRpc<unknown>("claim_voice_recordings_for_purge", {
    p_lease_token: leaseToken,
    p_limit: limit,
    p_now: now.toISOString(),
  });
  if (!result.ok) return result;
  const rows = Array.isArray(result.value)
    ? result.value.filter((row): row is VoiceRecordingPurgeClaim => {
      const value = normalizedRecord(row);
      return CALL_SID_PATTERN.test(String(value.call_sid ?? "")) &&
        RECORDING_SID_PATTERN.test(String(value.recording_sid ?? ""));
    })
    : [];
  return { ok: true, value: rows };
}

async function completeRecording(
  claim: VoiceRecordingPurgeClaim,
  leaseToken: string,
  now: Date,
): Promise<OperationResult<boolean>> {
  const result = await supabaseRpc<unknown>("complete_voice_recording_purge", {
    p_call_sid: claim.call_sid,
    p_recording_sid: claim.recording_sid,
    p_lease_token: leaseToken,
    p_purged_at: now.toISOString(),
  });
  return result.ok
    ? { ok: true, value: result.value === true }
    : result;
}

async function failRecording(
  claim: VoiceRecordingPurgeClaim,
  leaseToken: string,
  errorCode: string,
  now: Date,
): Promise<OperationResult<boolean>> {
  const result = await supabaseRpc<unknown>("fail_voice_recording_purge", {
    p_call_sid: claim.call_sid,
    p_recording_sid: claim.recording_sid,
    p_lease_token: leaseToken,
    p_error_code: errorCode.replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 80) || "provider_delete_failed",
    p_now: now.toISOString(),
  });
  return result.ok
    ? { ok: true, value: result.value === true }
    : result;
}

async function runDatabaseCleanup(
  limit: number,
  now: Date,
): Promise<OperationResult<VoiceRetentionSummary>> {
  const result = await supabaseRpc<unknown>("run_voice_data_retention", {
    p_limit: Math.min(100, Math.max(1, limit * 4)),
    p_now: now.toISOString(),
  });
  return result.ok ? { ok: true, value: normalizeSummary(result.value) } : result;
}

async function previewDatabaseCleanup(now: Date): Promise<OperationResult<VoiceRetentionPreview>> {
  const result = await supabaseRpc<unknown>("preview_voice_data_retention", {
    p_now: now.toISOString(),
  });
  return result.ok ? { ok: true, value: normalizePreview(result.value) } : result;
}

type TwilioDeleteCredentials = {
  accountSid: string;
  authorization: string;
};

function twilioDeleteCredentials(): OperationResult<TwilioDeleteCredentials> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  if (!ACCOUNT_SID_PATTERN.test(accountSid)) {
    return { ok: false, errorCode: "twilio_account_not_configured" };
  }

  const apiKeySid = process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SID?.trim() ?? "";
  const apiKeySecret = process.env.TWILIO_VOICE_RECORDINGS_API_KEY_SECRET?.trim() ?? "";
  if (apiKeySid || apiKeySecret) {
    if (!API_KEY_SID_PATTERN.test(apiKeySid) || Buffer.byteLength(apiKeySecret, "utf8") < 16) {
      return { ok: false, errorCode: "twilio_recordings_key_invalid" };
    }
    return {
      ok: true,
      value: {
        accountSid,
        authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`, "utf8").toString("base64")}`,
      },
    };
  }

  const allowAccountAuth = process.env.WILDWORKS_VOICE_RETENTION_ALLOW_ACCOUNT_AUTH
    ?.trim().toLowerCase() === "true";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!allowAccountAuth || !authToken) {
    return { ok: false, errorCode: "twilio_restricted_recordings_key_required" };
  }
  return {
    ok: true,
    value: {
      accountSid,
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`, "utf8").toString("base64")}`,
    },
  };
}

export function voiceRetentionConfigurationError(): string | null {
  const credentials = twilioDeleteCredentials();
  return credentials.ok ? null : credentials.errorCode;
}

export async function deleteTwilioRecording(
  recordingSid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TwilioRecordingDeleteResult> {
  if (!RECORDING_SID_PATTERN.test(recordingSid)) {
    return { ok: false, errorCode: "invalid_recording_sid" };
  }
  const credentials = twilioDeleteCredentials();
  if (!credentials.ok) return credentials;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TWILIO_DELETE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.value.accountSid}/Recordings/${recordingSid}.json`,
      {
        method: "DELETE",
        headers: { Authorization: credentials.value.authorization },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (response.status === 204) return { ok: true, alreadyAbsent: false };
    if (response.status === 404) return { ok: true, alreadyAbsent: true };
    return { ok: false, errorCode: `twilio_delete_http_${response.status}` };
  } catch {
    return { ok: false, errorCode: "twilio_delete_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

function productionDependencies(): VoiceRetentionDependencies {
  return {
    claimRecordings,
    completeRecording,
    failRecording,
    deleteRecording: (recordingSid) => deleteTwilioRecording(recordingSid),
    runDatabaseCleanup,
    previewDatabaseCleanup,
    randomToken: randomUUID,
  };
}

async function parallelMap<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await worker(item);
      }
    }),
  );
}

export async function executeVoiceRetention(
  options: { dryRun?: boolean; limit?: number; now?: Date } = {},
  dependencies: VoiceRetentionDependencies = productionDependencies(),
): Promise<VoiceRetentionExecutionResult> {
  const now = options.now ?? new Date();
  const limit = Math.min(MAX_BATCH_LIMIT, Math.max(1, Math.floor(options.limit ?? voiceRetentionBatchLimit())));
  const errors = new Set<string>();

  if (options.dryRun) {
    const preview = await dependencies.previewDatabaseCleanup(now);
    if (!preview.ok) errors.add(preview.errorCode);
    return {
      ok: preview.ok,
      dryRun: true,
      claimed: 0,
      recordingsDeleted: 0,
      recordingsAlreadyAbsent: 0,
      recordingDeleteFailures: 0,
      recordingFinalizeFailures: 0,
      databaseCleanup: null,
      preview: preview.ok ? preview.value : null,
      errorCodes: [...errors],
    };
  }

  const leaseToken = dependencies.randomToken();
  const claimed = await dependencies.claimRecordings(leaseToken, limit, now);
  if (!claimed.ok) errors.add(claimed.errorCode);
  const claims = claimed.ok ? claimed.value : [];
  let recordingsDeleted = 0;
  let recordingsAlreadyAbsent = 0;
  let recordingDeleteFailures = 0;
  let recordingFinalizeFailures = 0;

  await parallelMap(claims, TWILIO_DELETE_CONCURRENCY, async (claim) => {
    const deletion = await dependencies.deleteRecording(claim.recording_sid);
    if (!deletion.ok) {
      recordingDeleteFailures += 1;
      errors.add(deletion.errorCode);
      const released = await dependencies.failRecording(
        claim,
        leaseToken,
        deletion.errorCode,
        now,
      );
      if (!released.ok || !released.value) {
        recordingFinalizeFailures += 1;
        errors.add(released.ok ? "recording_failure_release_lost" : released.errorCode);
      }
      return;
    }

    const completed = await dependencies.completeRecording(claim, leaseToken, now);
    if (!completed.ok || !completed.value) {
      recordingFinalizeFailures += 1;
      errors.add(completed.ok ? "recording_completion_lost" : completed.errorCode);
      return;
    }
    if (deletion.alreadyAbsent) recordingsAlreadyAbsent += 1;
    else recordingsDeleted += 1;
  });

  const cleanup = await dependencies.runDatabaseCleanup(limit, now);
  if (!cleanup.ok) errors.add(cleanup.errorCode);
  return {
    ok: claimed.ok && cleanup.ok && recordingDeleteFailures === 0 && recordingFinalizeFailures === 0,
    dryRun: false,
    claimed: claims.length,
    recordingsDeleted,
    recordingsAlreadyAbsent,
    recordingDeleteFailures,
    recordingFinalizeFailures,
    databaseCleanup: cleanup.ok ? cleanup.value : null,
    preview: null,
    errorCodes: [...errors],
  };
}
