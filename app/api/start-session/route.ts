import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  CONTEXT_ID,
  LANGUAGE,
  VOICE_ID,
} from "../liveavatar/secrets";
import { logServerTelemetryEvent } from "../../../src/lib/serverTelemetryCapture";
import { logIScottOriginRejection } from "../../../src/lib/iscottOriginTelemetry";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkCriticalRateLimit } from "../../../src/lib/rateLimit";
import { iscottHandoffTruthDynamicVariables } from "../../../src/lib/iscottRuntimeSpeechTruth";

export const dynamic = "force-dynamic";
const WILDWORKS_AVATAR_REQUEST_HEADER = "x-wildworks-avatar-request";
const WILDWORKS_AVATAR_REQUEST_VALUE = "same-origin-v1";

export async function POST(request: Request) {
  const originError = assertAllowedOrigin(request, {
    trustedSameOriginMarker: {
      name: WILDWORKS_AVATAR_REQUEST_HEADER,
      value: WILDWORKS_AVATAR_REQUEST_VALUE,
    },
  });
  if (originError) {
    await logIScottOriginRejection(request, "/api/start-session").catch(() => undefined);
    return originError;
  }

  // Money ceiling, set deliberately 2026-08-24 (G: "what safeguards can we put
  // in to not burn money?"). These were running on library defaults
  // (2/min, 12/day/visitor, 100/day global) that nobody chose.
  //
  // Minting is the only thing here that costs real money, and it bills whether
  // or not anyone is talking. Measured real public traffic to date is ~6
  // sessions/day, so 40 leaves ~7x headroom while cutting the worst possible
  // day from 100 sessions to 40. perDay is per visitor IP: a bored kid gets 6
  // goes a day, a real buyer never needs a seventh.
  //
  // globalPerDay is scoped BY EVENT TYPE in reserve_api_rate_limit - the count
  // filters on event_type - so this ceiling cannot starve signup, lead confirm
  // or any other critical-limited route.
  //
  // This limiter fails CLOSED: any Supabase error returns unavailable rather
  // than minting. That is the correct trade for a paid endpoint.
  //
  // perDay 6 -> 30, Claude (bridge/installer) 2026-09-02 ~19:0x ET. G, by
  // voice, on the red "too many requests" painted over the avatar during his
  // iPad smoke rides: "We've dealt with this a dozen plus times. There's
  // plenty of credits there in liveavatar.com. It's a bug. Needs to be fixed
  // in the code." The block was never provider credits: G's own smoke testing
  // (5+ session starts today from one IP) burned the per-IP 6/day cap and the
  // raw 429 string painted over iScott. All current traffic IS G (standing
  // fact, 2026-09-01), so the per-IP cap must never interrupt a test day.
  // The real money ceiling is globalPerDay=40, and it is UNCHANGED - worst
  // possible spend day stays exactly where the 2026-08-24 decision put it.
  const rateLimitError = await checkCriticalRateLimit(request, {
    eventType: "rate_limit_liveavatar_session",
    perMinute: 2,
    perDay: 30,
    globalPerDay: 40,
  });
  if (rateLimitError) return rateLimitError;

  if (!API_KEY || !API_URL || !AVATAR_ID || !VOICE_ID) {
    await logServerTelemetryEvent({
      request,
      eventType: "liveavatar_token_failed",
      severity: "critical",
      provider: "liveavatar",
      route: "/api/start-session",
      statusCode: 500,
      payload: { reason: "provider_configuration_missing" },
    });
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
    // STAGED / INERT until the stored LiveAvatar context contains
    // ${wildworks_handoff_truth_policy}. LiveAvatar ignores extra dynamic
    // variables, so this local half is safe to land before the separately
    // authorized provider-context activation. Do not claim speech prevention
    // from this source change alone.
    dynamic_variables: iscottHandoffTruthDynamicVariables(),
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
        handoffTruthPolicyVariableSupplied: true,
        handoffTruthProviderPlaceholderActivationVerified: false,
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
