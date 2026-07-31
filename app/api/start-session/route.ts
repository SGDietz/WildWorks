import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  CONTEXT_ID,
  LANGUAGE,
  VOICE_ID,
} from "../liveavatar/secrets";
import { logServerTelemetryEvent } from "../../../src/lib/serverTelemetryCapture";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!API_KEY || !API_URL || !AVATAR_ID || !VOICE_ID) {
    return Response.json(
      {
        error:
          "LiveAvatar is missing LIVEAVATAR_API_KEY, LIVEAVATAR_API_URL, LIVEAVATAR_AVATAR_ID, or LIVEAVATAR_VOICE_ID",
      },
      { status: 500 },
    );
  }

  const avatarPersona: Record<string, string> = {
    voice_id: VOICE_ID,
    language: LANGUAGE || "en",
  };

  if (CONTEXT_ID) {
    avatarPersona.context_id = CONTEXT_ID;
  }

  const payload = {
    mode: "FULL",
    avatar_id: AVATAR_ID,
    max_session_duration: 20 * 60,
    avatar_persona: avatarPersona,
  };

  try {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data?.code !== 1000) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_token_failed",
        severity: "high",
        provider: "liveavatar",
        route: "/api/start-session",
        statusCode: res.status,
        payload: {
          code: data?.code,
          message: data?.message,
          avatarConfigured: Boolean(AVATAR_ID),
          voiceConfigured: Boolean(VOICE_ID),
          hasContext: Boolean(CONTEXT_ID),
        },
      });
      return Response.json(
        { error: data?.message || "Failed to start LiveAvatar session" },
        { status: res.status || 500 },
      );
    }

    await logServerTelemetryEvent({
      request,
      eventType: "liveavatar_token_created",
      severity: "low",
      provider: "liveavatar",
      sessionId: data?.data?.session_id,
      route: "/api/start-session",
      statusCode: 200,
      payload: {
        mode: payload.mode,
        maxSessionDuration: payload.max_session_duration,
        hasContext: Boolean(CONTEXT_ID),
      },
    });
    return Response.json(data.data);
  } catch (error) {
    await logServerTelemetryEvent({
      request,
      eventType: "liveavatar_token_exception",
      severity: "critical",
      provider: "liveavatar",
      route: "/api/start-session",
      statusCode: 500,
      payload: { message: error instanceof Error ? error.message : String(error) },
    });
    return Response.json({ error: "LiveAvatar token request failed" }, { status: 500 });
  }
}
