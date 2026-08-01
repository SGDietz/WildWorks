import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "./supabaseAdmin";
import { voiceBackendSignal } from "./voiceFetchTimeouts";
import { voiceRuntimeEnvironmentReady } from "./voiceEnvReadiness";

const READINESS_PATHS = [
  "conversation_sessions?select=session_id&limit=1",
  "conversation_messages?select=id&limit=1",
  "voice_call_context?select=call_sid&limit=1",
  "voice_email_outbox?select=id&limit=1",
];

export async function probeVoiceEventDependencies(): Promise<boolean> {
  if (!voiceRuntimeEnvironmentReady() || !isSupabaseAdminConfigured()) return false;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const responses = await Promise.all(READINESS_PATHS.map((path) => fetch(`${url}/rest/v1/${path}`, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
      signal: voiceBackendSignal(3_000),
    })));
    return responses.every((response) => response.ok);
  } catch {
    return false;
  }
}
