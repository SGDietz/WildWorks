import { MAX_TRANSCRIPTION_TEXT_CHARS, truncateUtf8String } from "./apiRouteSecurity";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { safeJsonPayload } from "./telemetryServer";
import { voiceBackendSignal } from "./voiceFetchTimeouts";

const DEFAULT_VOICE_SOURCE = "twilio_conversationrelay";
const MAX_IDENTIFIER_CHARS = 240;

type JsonObject = Record<string, unknown>;
type TimestampInput = Date | string;

export type VoicePersistenceResult = {
  ok: boolean;
  status: number;
  detail: string;
};

export type VoiceSessionPersistenceResult = VoicePersistenceResult & {
  sessionId: string | null;
};

export type VoiceMessagePersistenceResult = VoicePersistenceResult & {
  messageId: string | null;
  inserted: boolean;
  deduplicated: boolean;
};

export type UpsertVoiceSessionArgs = {
  sessionId: string;
  externalCallId: string;
  anonymousVisitorId?: string | null;
  route?: string | null;
  startedAt?: TimestampInput;
  source?: string;
  metadata?: JsonObject;
};

export type FinalizeVoiceSessionArgs = {
  sessionId?: string;
  externalCallId?: string;
  endedAt?: TimestampInput;
  metadata?: JsonObject;
};

export type InsertVoiceMessageArgs = {
  sessionId: string;
  providerMessageId: string;
  role: "user" | "assistant";
  message: string;
  anonymousVisitorId?: string | null;
  route?: string | null;
  viewport?: string | null;
  source?: string;
  createdAt?: TimestampInput;
  metadata?: JsonObject;
};

type ExistingVoiceSession = {
  session_id: string;
  metadata?: unknown;
  ended_at?: unknown;
};
type ExistingVoiceMessage = { id: string; session_id: string };
type RestResult<T> = VoicePersistenceResult & { rows: T[] };

function cleanIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > MAX_IDENTIFIER_CHARS || /[\u0000-\u001f\u007f]/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function cleanOptionalText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function cleanSource(value: unknown): string {
  return cleanOptionalText(value, 80) ?? DEFAULT_VOICE_SOURCE;
}

function toIsoTimestamp(value: TimestampInput | undefined, defaultNow = false): string | null {
  if (value === undefined) return defaultNow ? new Date().toISOString() : null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function mergedMetadata(existing: unknown, incoming: JsonObject | undefined): JsonObject | undefined {
  return incoming
    ? { ...metadataObject(existing), ...safeJsonPayload(incoming) }
    : undefined;
}

function failed(detail: string, status = 0): VoicePersistenceResult {
  return { ok: false, status, detail };
}

async function supabaseRest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: JsonObject; prefer?: string },
): Promise<RestResult<T>> {
  if (!isSupabaseAdminConfigured()) {
    return { ...failed("supabase_not_configured"), rows: [] };
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
        ...failed(await response.text().catch(() => ""), response.status),
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
      ...failed(error instanceof Error ? error.message : String(error)),
      rows: [],
    };
  }
}

async function findVoiceSession(
  column: "session_id" | "external_call_id",
  value: string,
): Promise<RestResult<ExistingVoiceSession>> {
  return supabaseRest(
    `conversation_sessions?select=session_id,metadata,ended_at&${column}=eq.${encodeURIComponent(value)}&limit=1`,
    { method: "GET" },
  );
}

async function patchVoiceSession(
  sessionId: string,
  row: JsonObject,
): Promise<VoiceSessionPersistenceResult> {
  const result = await supabaseRest<{ session_id?: unknown }>(
    `conversation_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id`,
    { method: "PATCH", body: row, prefer: "return=representation" },
  );
  if (!result.ok) return { ...result, sessionId: null };
  const persistedId = typeof result.rows[0]?.session_id === "string"
    ? result.rows[0].session_id
    : null;
  return persistedId
    ? { ok: true, status: result.status, detail: "", sessionId: persistedId }
    : { ...failed("voice_session_not_found", 404), sessionId: null };
}

/**
 * Creates a voice session or refreshes the canonical row for the same provider
 * call. The partial unique index on external_call_id is the concurrency guard.
 */
export async function upsertVoiceSession(
  args: UpsertVoiceSessionArgs,
): Promise<VoiceSessionPersistenceResult> {
  const sessionId = cleanIdentifier(args.sessionId);
  const externalCallId = cleanIdentifier(args.externalCallId);
  const startedAt = toIsoTimestamp(args.startedAt);
  if (!sessionId || !externalCallId) {
    return { ...failed("invalid_voice_session_identifier"), sessionId: null };
  }
  if (args.startedAt !== undefined && !startedAt) {
    return { ...failed("invalid_voice_session_started_at"), sessionId: null };
  }

  const existing = await findVoiceSession("external_call_id", externalCallId);
  if (!existing.ok) return { ...existing, sessionId: null };

  const mutableRow: JsonObject = {
    external_call_id: externalCallId,
    source: cleanSource(args.source),
    ...(args.anonymousVisitorId !== undefined
      ? { anonymous_visitor_id: cleanOptionalText(args.anonymousVisitorId, MAX_IDENTIFIER_CHARS) }
      : {}),
    ...(args.route !== undefined ? { route: cleanOptionalText(args.route, 220) } : {}),
    ...(startedAt ? { started_at: startedAt } : {}),
  };
  const metadata = mergedMetadata(existing.rows[0]?.metadata, args.metadata);
  if (metadata) mutableRow.metadata = metadata;

  if (existing.rows[0]) {
    return patchVoiceSession(existing.rows[0].session_id, mutableRow);
  }

  const insert = await supabaseRest<{ session_id?: unknown }>(
    "conversation_sessions?select=session_id",
    {
      method: "POST",
      body: {
        session_id: sessionId,
        ...mutableRow,
        metadata: safeJsonPayload(args.metadata),
      },
      prefer: "return=representation",
    },
  );
  if (insert.ok) {
    const persistedId = typeof insert.rows[0]?.session_id === "string"
      ? insert.rows[0].session_id
      : sessionId;
    return { ok: true, status: insert.status, detail: "", sessionId: persistedId };
  }
  if (insert.status !== 409) return { ...insert, sessionId: null };

  // A simultaneous retry may have inserted the same external call first.
  const raced = await findVoiceSession("external_call_id", externalCallId);
  if (!raced.ok) return { ...raced, sessionId: null };
  if (!raced.rows[0]) {
    return { ...failed("voice_session_conflict", 409), sessionId: null };
  }
  const raceMetadata = mergedMetadata(raced.rows[0].metadata, args.metadata);
  return patchVoiceSession(raced.rows[0].session_id, {
    ...mutableRow,
    ...(raceMetadata ? { metadata: raceMetadata } : {}),
  });
}

/** Marks a voice session complete. Calling it repeatedly is safe. */
export async function finalizeVoiceSession(
  args: FinalizeVoiceSessionArgs,
): Promise<VoiceSessionPersistenceResult> {
  const sessionId = cleanIdentifier(args.sessionId);
  const externalCallId = cleanIdentifier(args.externalCallId);
  const requestedEndedAt = toIsoTimestamp(args.endedAt);
  if (!sessionId && !externalCallId) {
    return { ...failed("voice_session_identifier_required"), sessionId: null };
  }
  if (args.endedAt !== undefined && !requestedEndedAt) {
    return { ...failed("invalid_voice_session_ended_at"), sessionId: null };
  }

  const existing = await findVoiceSession(
    sessionId ? "session_id" : "external_call_id",
    sessionId ?? externalCallId!,
  );
  if (!existing.ok) return { ...existing, sessionId: null };
  if (!existing.rows[0]) {
    return { ...failed("voice_session_not_found", 404), sessionId: null };
  }
  const persistedEndedAt = typeof existing.rows[0].ended_at === "string"
    ? toIsoTimestamp(existing.rows[0].ended_at)
    : null;
  const endedAt = requestedEndedAt ?? persistedEndedAt ?? new Date().toISOString();
  const metadata = mergedMetadata(existing.rows[0].metadata, args.metadata);
  return patchVoiceSession(existing.rows[0].session_id, {
    ended_at: endedAt,
    ...(metadata ? { metadata } : {}),
  });
}

async function findVoiceMessage(
  providerMessageId: string,
): Promise<RestResult<ExistingVoiceMessage>> {
  return supabaseRest(
    `conversation_messages?select=id,session_id&provider_message_id=eq.${encodeURIComponent(providerMessageId)}&limit=1`,
    { method: "GET" },
  );
}

/**
 * Inserts one provider transcript message. A replay of the same provider ID is
 * reported as a successful deduplication rather than creating another row.
 */
export async function insertDeduplicatedVoiceMessage(
  args: InsertVoiceMessageArgs,
): Promise<VoiceMessagePersistenceResult> {
  const sessionId = cleanIdentifier(args.sessionId);
  const providerMessageId = cleanIdentifier(args.providerMessageId);
  const message = cleanOptionalText(args.message, MAX_TRANSCRIPTION_TEXT_CHARS);
  const createdAt = toIsoTimestamp(args.createdAt);
  if (!sessionId || !providerMessageId || !message) {
    return {
      ...failed("invalid_voice_message"),
      messageId: null,
      inserted: false,
      deduplicated: false,
    };
  }
  if (args.createdAt !== undefined && !createdAt) {
    return {
      ...failed("invalid_voice_message_created_at"),
      messageId: null,
      inserted: false,
      deduplicated: false,
    };
  }

  const insert = await supabaseRest<ExistingVoiceMessage>(
    "conversation_messages?select=id,session_id",
    {
      method: "POST",
      body: {
        session_id: sessionId,
        provider_message_id: providerMessageId,
        role: args.role,
        message,
        source: cleanSource(args.source),
        metadata: safeJsonPayload(args.metadata),
        ...(args.anonymousVisitorId !== undefined
          ? { anonymous_visitor_id: cleanOptionalText(args.anonymousVisitorId, MAX_IDENTIFIER_CHARS) }
          : {}),
        ...(args.route !== undefined ? { route: cleanOptionalText(args.route, 220) } : {}),
        ...(args.viewport !== undefined ? { viewport: cleanOptionalText(args.viewport, 40) } : {}),
        ...(createdAt ? { created_at: createdAt } : {}),
      },
      prefer: "return=representation",
    },
  );
  if (insert.ok) {
    return {
      ok: true,
      status: insert.status,
      detail: "",
      messageId: insert.rows[0]?.id ?? null,
      inserted: true,
      deduplicated: false,
    };
  }
  if (insert.status !== 409) {
    return {
      ...insert,
      messageId: null,
      inserted: false,
      deduplicated: false,
    };
  }

  // Confirm the conflict came from a replay of this provider message.
  const existing = await findVoiceMessage(providerMessageId);
  if (!existing.ok) {
    return {
      ...existing,
      messageId: null,
      inserted: false,
      deduplicated: false,
    };
  }
  if (!existing.rows[0] || existing.rows[0].session_id !== sessionId) {
    return {
      ...failed("voice_message_conflict", 409),
      messageId: existing.rows[0]?.id ?? null,
      inserted: false,
      deduplicated: false,
    };
  }
  return {
    ok: true,
    status: 200,
    detail: "",
    messageId: existing.rows[0].id,
    inserted: false,
    deduplicated: true,
  };
}
