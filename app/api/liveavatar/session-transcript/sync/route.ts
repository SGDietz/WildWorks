// H473c: Node raises Error("aborted") from abortIncoming/socketOnClose when the
// CLIENT closes the connection mid-request. On this page that is routine - the
// avatar tears down on Finish and takes its in-flight requests with it. It is
// not a server fault and must not be logged as one, or the alert channel fills
// with noise that hides real faults.
const isClientDisconnect = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  const message = error.message || "";
  return name === "AbortError"
    || message === "aborted"
    || message.includes("ECONNRESET")
    || message.includes("aborted");
};

import { createHash } from "node:crypto";
import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../../src/lib/apiRouteSecurity";
import { logIScottOriginRejection } from "../../../../../src/lib/iscottOriginTelemetry";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "../../../../../src/lib/supabaseAdmin";
import { logServerTelemetryEvent } from "../../../../../src/lib/serverTelemetryCapture";
import { insertSupabaseRow } from "../../../../../src/lib/telemetryServer";
import {
  clearLiveAvatarIdleSession,
  noteLiveAvatarSessionActivity,
} from "../../../../../src/lib/liveAvatarIdleSessions";
import {
  getIScottLeadState,
  processIScottTranscriptRows,
  type IScottLeadState,
} from "../../../../../src/lib/iscottLeadCapture";
import {
  allowedIscottSpeech,
  mayClaimHandoffSent,
  isRepeatedTranscriptMoment,
  nextFreeTranscriptTimestamp,
  prepareForwardTranscriptRows,
  sessionLooksLikeOperatorQa,
} from "../../../../../src/lib/iscottLeadParsing";
import {
  iscottSpeechClaimsSendingNow,
  iscottSpeechClaimsVisibleNow,
} from "../../../../../src/lib/iscottRuntimeSpeechTruth";
import { API_KEY, API_URL } from "../../secrets";
import { classifyTraffic,
  canDispatchFirstPublicMessageAlert,
  isMeaningfulPublicMessage,
  trafficColumns, originFromRequest } from "../../../../../src/lib/trafficClassification";
import { notifyFirstPublicMessageByEmail } from "../../../../../src/lib/voiceEmailNotifications";
import {
  classifyTranscriptInsertFailure,
  sanitizeStoreErrorDetail,
} from "../../../../../src/lib/iscottTranscriptStore";

const SAFE_SESSION_TOKEN = /^[A-Za-z0-9._-]{20,4000}$/;

type TranscriptRow = {
  role: "user" | "avatar";
  transcript: string;
  absolute_timestamp: number;
  relative_timestamp?: number;
};

function cleanOptionalString(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function compactClientDevice(value: unknown, requestUserAgent: string | null): Record<string, string> {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const device = {
    deviceKind: cleanOptionalString(input.deviceKind, 40),
    os: cleanOptionalString(input.osName, 80),
    browser: cleanOptionalString(input.browserName, 80),
    screen: cleanOptionalString(input.screen, 60),
    userAgent: cleanOptionalString(input.userAgent, 400) ?? cleanOptionalString(requestUserAgent, 400),
  };
  return Object.fromEntries(
    Object.entries(device).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

function cleanSessionToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return SAFE_SESSION_TOKEN.test(cleaned) ? cleaned : null;
}

function normalizeTranscriptLineForDedupe(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transcriptDedupeKey(role: "user" | "assistant", text: string): string {
  return `${role}:${normalizeTranscriptLineForDedupe(text)}`;
}

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  };
}

function isTranscriptRow(value: unknown): value is TranscriptRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.role !== "user" && row.role !== "avatar") return false;
  if (typeof row.transcript !== "string" || !row.transcript.trim()) return false;
  return typeof row.absolute_timestamp === "number" && Number.isFinite(row.absolute_timestamp);
}

function parseTranscriptPayload(json: unknown): {
  sessionActive: boolean | null;
  nextTimestamp: number | null;
  transcriptData: TranscriptRow[];
} | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const rawList = data.transcript_data;
  if (!Array.isArray(rawList)) return null;
  const transcriptData = rawList.filter(isTranscriptRow);
  const sessionActive =
    typeof data.session_active === "boolean" ? data.session_active : null;
  const nextTimestamp =
    typeof data.next_timestamp === "number" && Number.isFinite(data.next_timestamp)
      ? data.next_timestamp
      : null;
  return { sessionActive, nextTimestamp, transcriptData };
}

/**
 * Fingerprint of the visitor's session token. Never the token itself: this is
 * written into conversation_sessions.metadata, which other code reads.
 */
function tokenFingerprint(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex").slice(0, 32);
}

/**
 * Who already owns this LiveAvatar session?
 *
 * Returns the stored fingerprint, or null when nobody has claimed the session
 * yet (the very first sync). Returns undefined when the lookup itself failed -
 * the caller treats that as "cannot verify" and refuses, because failing open
 * here is what the whole fix exists to prevent.
 */
async function storedSessionFingerprint(
  liveAvatarSessionId: string,
): Promise<string | null | undefined> {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(
      `${url}/rest/v1/conversation_sessions?session_id=eq.${encodeURIComponent(liveAvatarSessionId)}&select=metadata&limit=1`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store" },
    );
    if (!res.ok) return undefined;
    const rows = (await res.json()) as Array<{ metadata?: Record<string, unknown> | null }>;
    if (rows.length === 0) return null;
    const fp = rows[0]?.metadata?.token_fp;
    return typeof fp === "string" && fp.length > 0 ? fp : null;
  } catch {
    return undefined;
  }
}

function isLiveAvatarResponseSuccess(json: unknown, httpOk: boolean): boolean {
  if (!httpOk) return false;
  if (!json || typeof json !== "object") return false;
  const code = (json as Record<string, unknown>).code;
  return code === undefined || code === 100 || code === 1000;
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request, {
    trustedSameOriginMarker: {
      name: "x-wildworks-avatar-request",
      value: "same-origin-v1",
    },
  });
  if (originErr) {
    await logIScottOriginRejection(request, "/api/liveavatar/session-transcript/sync").catch(() => undefined);
    return originErr;
  }
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const liveAvatarSessionId = typeof body?.liveAvatarSessionId === "string" ? body.liveAvatarSessionId.trim() : "";
    const sessionToken = cleanSessionToken(body?.sessionToken);
    const startTimestamp = body?.startTimestamp;
    const anonymousVisitorId = cleanOptionalString(body?.anonymousVisitorId, 160);
    const route = cleanOptionalString(body?.route, 180);
    const viewport = cleanOptionalString(body?.viewport, 40);
    const reason = cleanOptionalString(body?.reason, 80);
    const clientDevice = compactClientDevice(body?.device, request.headers.get("user-agent"));
    const traffic = await classifyTraffic({
      anonymousVisitorId,
      userAgent: request.headers.get("user-agent"),
      origin: originFromRequest(request),
    });
    const classified = trafficColumns(traffic);

    if (!isSafeTranscriptionSessionId(liveAvatarSessionId)) {
      return Response.json({ error: "Invalid liveAvatarSessionId" }, { status: 400 });
    }

    if (!sessionToken) {
      return Response.json({ error: "Invalid sessionToken" }, { status: 400 });
    }

    if (!API_KEY) {
      return Response.json({ error: "LiveAvatar API key is not configured" }, { status: 503 });
    }

    if (
      startTimestamp !== undefined &&
      startTimestamp !== null &&
      (typeof startTimestamp !== "number" || !Number.isFinite(startTimestamp))
    ) {
      return Response.json({ error: "Invalid startTimestamp" }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_transcript_sync_skipped_supabase_missing",
        severity: "medium",
        provider: "supabase",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        payload: { configured: false, reason },
      });
      return Response.json({ ok: false, skipped: true, error: "Supabase is not configured" }, { status: 202 });
    }

    // OWNERSHIP GATE (2026-08-24). Runs before the provider is touched.
    // The first sync of a session claims it; every later sync must present the
    // same token. Without this, sessionToken was decorative and any caller
    // could read any visitor's transcript with the account key.
    const callerFingerprint = tokenFingerprint(sessionToken);
    const ownerFingerprint = await storedSessionFingerprint(liveAvatarSessionId);

    if (ownerFingerprint === undefined) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_transcript_owner_check_unavailable",
        severity: "high",
        provider: "supabase",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: 503,
        payload: { reason },
      });
      return Response.json(
        { error: "Session ownership could not be verified. Please try again." },
        { status: 503 },
      );
    }

    if (ownerFingerprint !== null && ownerFingerprint !== callerFingerprint) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_transcript_owner_mismatch",
        severity: "critical",
        provider: "liveavatar",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: 403,
        payload: { reason },
      });
      return Response.json({ error: "Session does not belong to this caller" }, { status: 403 });
    }

    const params = new URLSearchParams();
    if (typeof startTimestamp === "number" && Number.isFinite(startTimestamp)) {
      params.set("start_timestamp", String(Math.floor(startTimestamp)));
    }

    const baseUrl = API_URL.replace(/\/$/, "");
    const transcriptUrl = `${baseUrl}/v1/sessions/${encodeURIComponent(liveAvatarSessionId)}/transcript${
      params.toString() ? `?${params}` : ""
    }`;
    const liveAvatarResponse = await fetch(transcriptUrl, {
      method: "GET",
      headers: { "X-API-KEY": API_KEY },
      cache: "no-store",
    });
    const liveAvatarJson: unknown = await liveAvatarResponse.json().catch(() => null);

    if (!isLiveAvatarResponseSuccess(liveAvatarJson, liveAvatarResponse.ok)) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_transcript_sync_failed",
        severity: "medium",
        provider: "liveavatar",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: liveAvatarResponse.status,
        payload: { startTimestamp, reason, response: liveAvatarJson },
      });
      return Response.json(
        { error: "Failed to fetch LiveAvatar transcript", status: liveAvatarResponse.status },
        { status: liveAvatarResponse.status <= 599 ? liveAvatarResponse.status : 502 },
      );
    }

    const parsed = parseTranscriptPayload(liveAvatarJson);
    if (!parsed) {
      return Response.json({ error: "Unexpected transcript response shape" }, { status: 502 });
    }

    const sessionPersistence = await insertSupabaseRow(
      "conversation_sessions",
      {
        session_id: liveAvatarSessionId,
        liveavatar_session_id: liveAvatarSessionId,
        anonymous_visitor_id: anonymousVisitorId,
        route,
        source: "liveavatar_proxy",
        // token_fp claims the session for this visitor's token. The upsert
        // merges duplicates and replaces metadata wholesale, so it must be
        // written on every sync or the claim would be erased by the next one.
        metadata: { reason, viewport, session_active: parsed.sessionActive, token_fp: callerFingerprint },
        ...classified,
        ...(parsed.sessionActive === false
          && (reason === "session_stop" || reason === "session_ended" || reason === "page_hidden" || reason === "pagehide")
          ? { ended_at: new Date().toISOString() }
          : {}),
      },
      { onConflict: "session_id", mergeDuplicates: true },
    );
    if (!sessionPersistence.ok) {
      await logServerTelemetryEvent({
        request,
        eventType: "liveavatar_session_store_failed",
        severity: "high",
        provider: "supabase",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: sessionPersistence.status || 502,
        payload: { reason, detail: sessionPersistence.detail },
      });
      return Response.json({ error: "Failed to store LiveAvatar session" }, { status: 502 });
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const candidateRows = prepareForwardTranscriptRows(
      parsed.transcriptData
        .map((row) => ({
          session_id: liveAvatarSessionId,
          anonymous_visitor_id: anonymousVisitorId,
          role: row.role === "avatar" ? ("assistant" as const) : ("user" as const),
          message: truncateUtf8String(row.transcript.trim(), MAX_TRANSCRIPTION_TEXT_CHARS),
          la_absolute_timestamp: Math.floor(row.absolute_timestamp),
          source: "liveavatar_proxy_api",
          route,
          viewport,
          metadata: {
            relative_timestamp: row.relative_timestamp ?? null,
            reason,
          },
          ...classified,
        }))
        .filter((row) => Boolean(row.message)),
    );

    // G's desktop rides 1cc18a84 (15:46 ET) and f2815084 (16:30 ET), 2026-09-03.
    // Both died at the permission step with NO answer in the transcript while
    // the avatar plainly heard one (it said the send line six seconds later).
    // The provider's own transcript for f2815084 carries the second "Yes." -
    // this route threw it away: the dedupe key was role + words only, so any
    // line a visitor says twice in a session ("Yes." to the read-back, then
    // "Yes." to the permission question) was treated as a repeat of the first
    // and never stored. His phone and iPad rides the same hour passed only
    // because he happened to use different words ("Yes." then "Sure.";
    // "You did." then "Yes."). A repeat is only a repeat at the SAME MOMENT:
    // the key keeps role + words, and the provider's own absolute timestamp
    // decides, with a two-second tolerance for the provider re-stamping a
    // line between syncs. Helper + tolerance live in iscottLeadParsing so
    // check-iscott-transcript-repeat-yes.mjs can prove them.
    const existingMoments = new Map<string, number[]>();
    const takenTimestamps = new Set<number>();
    const rememberMoment = (key: string, at: number | null) => {
      const list = existingMoments.get(key);
      if (list) list.push(at ?? Number.NaN);
      else existingMoments.set(key, [at ?? Number.NaN]);
    };
    const existingResponse = await fetch(
      `${url}/rest/v1/conversation_messages?select=role,message,la_absolute_timestamp,metadata&session_id=eq.${encodeURIComponent(liveAvatarSessionId)}&source=not.in.(app_event,telemetry_fallback)&limit=700`,
      { method: "GET", headers: supabaseHeaders(serviceRoleKey) },
    );
    if (existingResponse.ok) {
      const existingRows = (await existingResponse.json().catch(() => [])) as Array<{
        role?: unknown;
        message?: unknown;
        la_absolute_timestamp?: unknown;
        metadata?: unknown;
      }>;
      for (const row of existingRows) {
        if (row.role !== "user" && row.role !== "assistant") continue;
        if (typeof row.message !== "string" || !row.message.trim()) continue;
        const stamped = typeof row.la_absolute_timestamp === "number" && Number.isFinite(row.la_absolute_timestamp)
          ? Math.floor(row.la_absolute_timestamp)
          : null;
        const meta = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
        const original = typeof meta.original_absolute_timestamp === "number" && Number.isFinite(meta.original_absolute_timestamp)
          ? Math.floor(meta.original_absolute_timestamp)
          : stamped;
        rememberMoment(transcriptDedupeKey(row.role, row.message), original);
        if (stamped !== null) takenTimestamps.add(stamped);
      }
    }

    const rows = candidateRows.flatMap((row) => {
      const key = transcriptDedupeKey(row.role, row.message);
      if (!normalizeTranscriptLineForDedupe(row.message)) return [];
      const originalTimestamp = row.la_absolute_timestamp;
      if (isRepeatedTranscriptMoment(existingMoments.get(key), originalTimestamp)) return [];
      rememberMoment(key, originalTimestamp);

      // Legacy uniqueness offset only. Canonical/consent time stays original_absolute_timestamp
      // until 202608170001_iscott120_transcript_arrival_index.sql is applied by Chief.
      // Unique across the session clock, not per role, so user+assistant same-second rows do not 500.
      const resolvedTimestamp = nextFreeTranscriptTimestamp(originalTimestamp, takenTimestamps);

      return [{
        ...row,
        la_absolute_timestamp: resolvedTimestamp,
        metadata: resolvedTimestamp === originalTimestamp
          ? row.metadata
          : {
              ...row.metadata,
              original_absolute_timestamp: originalTimestamp,
              timestamp_adjusted_seconds: resolvedTimestamp - originalTimestamp,
            },
      }];
    });

    if (parsed.sessionActive === false) {
      clearLiveAvatarIdleSession(sessionToken);
    } else if (rows.length > 0) {
      noteLiveAvatarSessionActivity(sessionToken);
    }

    let storeFailed = false;
    if (rows.length > 0) {
      const insertResponse = await fetch(`${url}/rest/v1/conversation_messages`, {
        method: "POST",
        headers: supabaseHeaders(serviceRoleKey),
        body: JSON.stringify(rows),
      });
      if (!insertResponse.ok) {
        const detail = await insertResponse.text();
        const classifiedFailure = classifyTranscriptInsertFailure(insertResponse.status, detail);
        if (!classifiedFailure.treatAsStored) {
          await logServerTelemetryEvent({
            request,
            eventType: "liveavatar_transcript_store_failed",
            severity: "high",
            provider: "supabase",
            sessionId: liveAvatarSessionId,
            route: "/api/liveavatar/session-transcript/sync",
            statusCode: insertResponse.status,
            payload: {
              stage: "persist",
              reason,
              received: parsed.transcriptData.length,
              attempted: rows.length,
              detail: sanitizeStoreErrorDetail(detail),
              kind: classifiedFailure.kind,
            },
          });
          storeFailed = true;
        }
      }
    }

    const firstMeaningfulPublicMessage = canDispatchFirstPublicMessageAlert({
      classification: traffic,
      visitorId: anonymousVisitorId,
      sessionId: liveAvatarSessionId,
      operatorQa: sessionLooksLikeOperatorQa(
        rows.filter((row) => row.role === "user").map((row) => row.message),
      ),
    })
      ? rows.find((row) => row.role === "user" && isMeaningfulPublicMessage(row.message))
      : null;
    if (firstMeaningfulPublicMessage) {
      const server = request.headers;
      const location = [
        server.get("x-vercel-ip-city"),
        server.get("x-vercel-ip-country-region"),
        server.get("x-vercel-ip-country"),
      ].filter(Boolean).join(", ") || null;
      const notification = await notifyFirstPublicMessageByEmail({
        sessionId: liveAvatarSessionId,
        anonymousVisitorId,
        message: firstMeaningfulPublicMessage.message,
        route,
        receivedAt: new Date(),
        location,
        device: [request.headers.get("user-agent"), viewport].filter(Boolean).join(" | "),
        metadata: {
          classificationReason: traffic.reason,
          classificationConfidence: traffic.confidence,
        },
      });
      if (!notification.queued) {
        await logServerTelemetryEvent({
          request,
          eventType: "public_message_notification_failed",
          severity: "high",
          provider: "resend",
          sessionId: liveAvatarSessionId,
          anonymousVisitorId,
          route: "/api/liveavatar/session-transcript/sync",
          statusCode: notification.status || 502,
          payload: { detail: notification.detail },
        });
      }
    }

    let leadState: IScottLeadState | null = null;
    let leadCaptureError: string | null = null;
    try {
      leadState = rows.length > 0
        ? await processIScottTranscriptRows({
            sessionId: liveAvatarSessionId,
            anonymousVisitorId,
            route,
            clientDevice,
            rows: rows.map((row) => ({
              role: row.role,
              message: row.message,
              laAbsoluteTimestamp:
                // Only the timestamp-adjusted branch of this metadata union carries
                // original_absolute_timestamp, so probe for it before reading it.
                row.metadata
                && "original_absolute_timestamp" in row.metadata
                && typeof row.metadata.original_absolute_timestamp === "number"
                  ? row.metadata.original_absolute_timestamp
                  : row.la_absolute_timestamp,
            })),
          })
        : await getIScottLeadState(liveAvatarSessionId);
    } catch (error) {
      leadCaptureError = error instanceof Error ? error.message : String(error);
      await logServerTelemetryEvent({
        request,
        eventType: "iscott_lead_capture_failed",
        severity: "high",
        provider: "supabase",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: 502,
        payload: { reason, detail: leadCaptureError },
      });
    }

    // Detection only: provider speech has already happened by the time the
    // transcript reaches this route. This creates a privacy-safe operational
    // diagnostic, but it is not the pre-speech guard. The staged dynamic policy
    // in /api/start-session becomes preventive only after the separately
    // authorized provider context installs its named placeholder.
    const speechTruth = {
      status: leadState?.status ?? null,
      submittedAt: leadState?.submittedAt ?? null,
      notificationStatus: leadState?.notificationStatus ?? null,
      notificationOutboxId: leadState?.notificationOutboxId ?? null,
    };
    // The provider cannot observe the visitor's browser, so an on-screen /
    // visible-now claim is a false claim regardless of persisted delivery
    // truth. Gating it on mayClaimHandoffSent would let the exact ride phrase
    // through the moment a real handoff succeeded. The sending-now claim,
    // by contrast, becomes truthful once the visitor's details are actually
    // delivered, so that gate stays.
    const falseHandoffSpeech = rows
      .filter((row) => row.role === "assistant")
      .filter((row) => {
        const result = allowedIscottSpeech(row.message, speechTruth);
        return result.reason === "false_handoff_claim"
          || (iscottSpeechClaimsSendingNow(row.message) && !mayClaimHandoffSent(speechTruth))
          || iscottSpeechClaimsVisibleNow(row.message);
      });

    if (falseHandoffSpeech.length > 0) {
      await logServerTelemetryEvent({
        request,
        eventType: "iscott_false_handoff_speech_detected",
        severity: "high",
        provider: "liveavatar",
        sessionId: liveAvatarSessionId,
        route: "/api/liveavatar/session-transcript/sync",
        statusCode: 200,
        payload: {
          count: falseHandoffSpeech.length,
          leadStatus: leadState?.status ?? null,
          notificationStatus: leadState?.notificationStatus ?? null,
          leadCaptureError: Boolean(leadCaptureError),
        },
      });
    }

    await logServerTelemetryEvent({
      request,
      eventType: "liveavatar_transcript_synced",
      severity: "low",
      provider: "liveavatar",
      sessionId: liveAvatarSessionId,
      route: "/api/liveavatar/session-transcript/sync",
      statusCode: 200,
      payload: {
        sessionActive: parsed.sessionActive,
        nextTimestamp: parsed.nextTimestamp,
        received: parsed.transcriptData.length,
        stored: storeFailed ? 0 : rows.length,
        deduped: candidateRows.length - rows.length,
        userRows: rows.filter((row) => row.role === "user").length,
        assistantRows: rows.filter((row) => row.role === "assistant").length,
        falseHandoffSpeechDetected: falseHandoffSpeech.length,
        leadStatus: leadState?.status ?? null,
        leadCaptureError,
        storeFailed,
        reason,
      },
    });

    return Response.json({
      ok: true,
      sessionActive: parsed.sessionActive,
      nextTimestamp: parsed.nextTimestamp,
      received: parsed.transcriptData.length,
      stored: storeFailed ? 0 : rows.length,
      deduped: candidateRows.length - rows.length,
      lead: leadState,
      leadCaptureError,
      falseHandoffSpeechDetected: falseHandoffSpeech.length,
      storeFailed,
    });
  } catch (error) {
    console.error("Error syncing LiveAvatar transcript:", error);
    const clientHungUp = isClientDisconnect(error);
    await logServerTelemetryEvent({
      request,
      eventType: clientHungUp
        ? "liveavatar_transcript_sync_client_disconnected"
        : "liveavatar_transcript_sync_failed",
      severity: clientHungUp ? "low" : "high",
      provider: "liveavatar",
      route: "/api/liveavatar/session-transcript/sync",
      statusCode: clientHungUp ? 499 : 500,
      payload: {
        // H471 2026-09-02: this block used to log a bare 500. Two stop failures
        // during G's 20:52 ride were therefore undiagnosable. Error name,
        // message and a short stack are bounded and carry no secrets.
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 400),
        errorStack: (error instanceof Error && error.stack ? error.stack : "").slice(0, 600),
      },
    });
    return Response.json({ error: "Failed to sync LiveAvatar transcript" }, { status: 500 });
  }
}
