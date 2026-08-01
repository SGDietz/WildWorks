import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { voiceBackendSignal } from "./voiceFetchTimeouts";

const CALL_SID_PATTERN = /^CA[0-9a-fA-F]{32}$/;
const RECORDING_SID_PATTERN = /^RE[0-9a-fA-F]{32}$/;
const TRANSCRIPTION_SID_PATTERN = /^TR[0-9a-fA-F]{32}$/;

type JsonObject = Record<string, unknown>;

export type VoiceCallContext = {
  call_sid: string;
  caller_phone: string | null;
  recording_sid: string | null;
  recording_status: string | null;
  recording_duration: number | null;
  transcription_sid: string | null;
  transcription_status: string | null;
  transcription_text: string | null;
  updated_at: string;
};

const CONTEXT_SELECT = "call_sid,caller_phone,recording_sid,recording_status,recording_duration,transcription_sid,transcription_status,transcription_text,updated_at";

export type VoiceCallContextResult = {
  ok: boolean;
  status: number;
  detail: string;
  context: VoiceCallContext | null;
};

function validSid(value: string | null | undefined, pattern: RegExp): string | null {
  const candidate = value?.trim() ?? "";
  return pattern.test(candidate) ? candidate : null;
}

function cleanPhone(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return candidate && candidate.length <= 80 && !/[\u0000-\u001f\u007f]/.test(candidate)
    ? candidate
    : null;
}

function cleanStatus(value: string | null | undefined): string | null {
  const candidate = value?.trim().toLowerCase() ?? "";
  return /^[a-z][a-z_-]{0,39}$/.test(candidate) ? candidate : null;
}

function cleanTranscript(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return candidate ? candidate.slice(0, 12_000) : null;
}

async function rest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: JsonObject; prefer?: string },
): Promise<{ ok: boolean; status: number; detail: string; rows: T[] }> {
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

async function upsert(
  callSid: string,
  row: JsonObject,
): Promise<VoiceCallContextResult> {
  const result = await rest<VoiceCallContext>(
    `voice_call_context?on_conflict=call_sid&select=${CONTEXT_SELECT}`,
    {
      method: "POST",
      body: { call_sid: callSid, ...row, updated_at: new Date().toISOString() },
      prefer: "resolution=merge-duplicates,return=representation",
    },
  );
  return {
    ok: result.ok,
    status: result.status,
    detail: result.detail,
    context: result.rows[0] ?? null,
  };
}

export async function upsertIncomingVoiceCall(args: {
  callSid: string | null;
  callerPhone: string | null;
}): Promise<VoiceCallContextResult> {
  const callSid = validSid(args.callSid, CALL_SID_PATTERN);
  if (!callSid) return { ok: false, status: 0, detail: "invalid_call_sid", context: null };
  return upsert(callSid, { caller_phone: cleanPhone(args.callerPhone) });
}

export async function upsertVoiceRecording(args: {
  callSid: string | null;
  recordingSid: string | null;
  status?: string | null;
  duration?: string | number | null;
}): Promise<VoiceCallContextResult> {
  const callSid = validSid(args.callSid, CALL_SID_PATTERN);
  const recordingSid = validSid(args.recordingSid, RECORDING_SID_PATTERN);
  const status = cleanStatus(args.status);
  if (!callSid || (!recordingSid && status !== "absent" && status !== "failed")) {
    return { ok: false, status: 0, detail: "invalid_recording_context", context: null };
  }
  const parsedDuration = Number(args.duration);
  return upsert(callSid, {
    ...(recordingSid ? { recording_sid: recordingSid } : {}),
    recording_status: status,
    recording_duration: Number.isFinite(parsedDuration) && parsedDuration >= 0
      ? Math.floor(parsedDuration)
      : null,
  });
}

export async function upsertVoiceTranscription(args: {
  callSid: string | null;
  recordingSid: string | null;
  transcriptionSid?: string | null;
  status?: string | null;
  text?: string | null;
  callerPhone?: string | null;
}): Promise<VoiceCallContextResult> {
  const callSid = validSid(args.callSid, CALL_SID_PATTERN);
  const recordingSid = validSid(args.recordingSid, RECORDING_SID_PATTERN);
  if (!callSid || !recordingSid) {
    return { ok: false, status: 0, detail: "invalid_transcription_context", context: null };
  }
  return upsert(callSid, {
    recording_sid: recordingSid,
    transcription_sid: validSid(args.transcriptionSid, TRANSCRIPTION_SID_PATTERN),
    transcription_status: cleanStatus(args.status),
    transcription_text: cleanTranscript(args.text),
    ...(args.callerPhone ? { caller_phone: cleanPhone(args.callerPhone) } : {}),
  });
}

export async function getVoiceCallContext(args: {
  callSid?: string | null;
  recordingSid?: string | null;
}): Promise<VoiceCallContextResult> {
  const callSid = validSid(args.callSid, CALL_SID_PATTERN);
  const recordingSid = validSid(args.recordingSid, RECORDING_SID_PATTERN);
  if (!callSid && !recordingSid) {
    return { ok: false, status: 0, detail: "voice_call_context_identifier_required", context: null };
  }
  const column = callSid ? "call_sid" : "recording_sid";
  const value = callSid ?? recordingSid!;
  const result = await rest<VoiceCallContext>(
    `voice_call_context?select=${CONTEXT_SELECT}&${column}=eq.${encodeURIComponent(value)}&limit=1`,
    { method: "GET" },
  );
  return {
    ok: result.ok,
    status: result.status,
    detail: result.detail,
    context: result.rows[0] ?? null,
  };
}

export async function listStaleVoiceTranscriptions(
  olderThan: Date,
  limit = 10,
): Promise<{ ok: boolean; status: number; detail: string; contexts: VoiceCallContext[] }> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const result = await rest<VoiceCallContext>(
    `voice_call_context?select=${CONTEXT_SELECT}&recording_status=in.(completed,absent,failed)&transcription_status=is.null&updated_at=lt.${encodeURIComponent(olderThan.toISOString())}&order=updated_at.asc&limit=${safeLimit}`,
    { method: "GET" },
  );
  return { ok: result.ok, status: result.status, detail: result.detail, contexts: result.rows };
}

export async function markVoiceTranscriptionMissing(
  callSidValue: string,
  expectedUpdatedAt: string,
): Promise<VoiceCallContextResult> {
  const callSid = validSid(callSidValue, CALL_SID_PATTERN);
  if (!callSid || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return { ok: false, status: 0, detail: "invalid_missing_transcription_claim", context: null };
  }
  const result = await rest<VoiceCallContext>(
    `voice_call_context?call_sid=eq.${encodeURIComponent(callSid)}&transcription_status=is.null&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}&select=${CONTEXT_SELECT}`,
    {
      method: "PATCH",
      body: { transcription_status: "missing", updated_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  );
  return {
    ok: result.ok,
    status: result.status,
    detail: result.detail,
    context: result.rows[0] ?? null,
  };
}
