import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { isSupabaseAdminConfigured } from "../../../../src/lib/supabaseAdmin";
import {
  getRequestTelemetryContext,
  insertConversationTelemetryFallback,
  insertSupabaseRow,
  safeJsonPayload,
  storeRawTelemetryBackup,
} from "../../../../src/lib/telemetryServer";

type Severity = "critical" | "high" | "medium" | "low";
type Sentiment = "negative" | "positive";

const MAX_TEXT_CHARS = 1000;
const MAX_ROUTE_CHARS = 180;
const SAFE_ID = /^[a-zA-Z0-9:_-]{4,160}$/;
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const SENTIMENTS = new Set(["negative", "positive"]);
const LIST_ACTIONS = new Set([
  "create",
  "open",
  "view",
  "close",
  "add",
  "remove",
  "rename",
  "delete",
  "update",
  "style",
]);

function cleanString(value: unknown, maxChars = MAX_TEXT_CHARS): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}
function cleanId(value: unknown): string | null {
  const cleaned = cleanString(value, 160);
  return cleaned && SAFE_ID.test(cleaned) ? cleaned : null;
}

function cleanSessionId(value: unknown): string | null {
  if (value == null || value === "") return null;
  return isSafeTranscriptionSessionId(value) ? value.trim() : null;
}

function cleanFallbackSessionId(
  sessionId: string | null,
  anonymousVisitorId: string | null,
): string {
  if (sessionId) return sessionId;
  if (anonymousVisitorId && isSafeTranscriptionSessionId(anonymousVisitorId)) {
    return anonymousVisitorId;
  }
  return "server_app_event";
}

function cleanSeverity(value: unknown, fallback: Severity): Severity {
  const cleaned = cleanString(value, 16);
  return cleaned && SEVERITIES.has(cleaned) ? (cleaned as Severity) : fallback;
}

function cleanSentiment(value: unknown): Sentiment {
  const cleaned = cleanString(value, 16);
  return cleaned && SENTIMENTS.has(cleaned)
    ? (cleaned as Sentiment)
    : "negative";
}

function cleanStatusCode(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 100 && value <= 599 ? value : null;
}

function cleanStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 220))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function valueFromRecord(
  record: Record<string, unknown>,
  key: string,
  maxChars = MAX_TEXT_CHARS,
): string | null {
  return cleanString(record[key], maxChars);
}

async function storeWithConversationFallback(args: {
  table: string;
  row: Record<string, unknown>;
  fallbackSessionId: string;
  anonymousVisitorId?: string | null;
  source: string;
  fallbackValue: Record<string, unknown>;
  onConflict?: string;
  mergeDuplicates?: boolean;
}): Promise<Response | null> {
  const rawBackupOk = await storeRawTelemetryBackup({
    category: args.source,
    sessionId: args.fallbackSessionId,
    anonymousVisitorId: args.anonymousVisitorId,
    value: args.fallbackValue,
  });

  const result = await insertSupabaseRow(args.table, args.row, {
    onConflict: args.onConflict,
    mergeDuplicates: args.mergeDuplicates,
  });
  if (result.ok) return null;

  const fallbackOk = await insertConversationTelemetryFallback({
    sessionId: args.fallbackSessionId,
    source: args.source,
    value: {
      table: args.table,
      tableInsertStatus: result.status,
      tableInsertDetail: result.detail,
      ...args.fallbackValue,
    },
  });
  if (fallbackOk) {
    console.warn(`${args.table} insert used conversation fallback:`, result.detail);
    return null;
  }
  if (rawBackupOk) {
    console.warn(`${args.table} insert used raw storage backup:`, result.detail);
    return null;
  }

  console.error(`${args.table} insert failed:`, result.detail);
  return new Response(JSON.stringify({ error: "Failed to store app event" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      { ok: false, skipped: true, error: "Supabase is not configured" },
      { status: 202 },
    );
  }

  try {
    const body = await request.json();
    const server = getRequestTelemetryContext(request);
    const category = cleanString(body?.category, 32) ?? "app";
    const sessionId =
      cleanSessionId(body?.sessionId) ?? cleanSessionId(body?.clientSessionId);
    const anonymousVisitorId = cleanId(body?.anonymousVisitorId);
    const fallbackSessionId = cleanFallbackSessionId(
      sessionId,
      anonymousVisitorId,
    );
    const route = cleanString(body?.route, MAX_ROUTE_CHARS);
    const viewport = cleanString(body?.viewport, 40);
    const device = safeJsonPayload(body?.device);
    const payload = {
      ...safeJsonPayload(body?.payload),
      clientDevice: device,
      server,
    };
    const deviceKind =
      cleanString(body?.deviceKind, 80) ??
      valueFromRecord(device, "deviceKind", 80);
    const browserName = valueFromRecord(device, "browserName", 120);
    const osName = valueFromRecord(device, "osName", 120);
    const screen = valueFromRecord(device, "screen", 80);
    const language = valueFromRecord(device, "language", 80);
    const timezone = valueFromRecord(device, "timezone", 120);
    const platform = valueFromRecord(device, "platform", 180);
    const connectionType = valueFromRecord(device, "connectionType", 80);
    const touchSupport =
      typeof device.touchSupport === "boolean" ? device.touchSupport : null;

    if (category === "session") {
      const eventType = cleanString(body?.eventType, 120) ?? "page_open";
      const sessionRow = {
        session_id: fallbackSessionId,
        anonymous_visitor_id: anonymousVisitorId,
        route,
        deployment_url: server.deploymentUrl,
        referrer: server.referer,
        origin: server.origin,
        user_agent: server.userAgent,
        ip_address: server.ipAddress,
        forwarded_for: server.forwardedFor,
        country: server.country,
        region: server.region,
        city: server.city,
        latitude: server.latitude,
        longitude: server.longitude,
        server_timezone: server.timezone,
        device_kind: deviceKind,
        browser_name: browserName,
        os_name: osName,
        viewport,
        screen,
        language,
        client_timezone: timezone,
        platform,
        touch_support: touchSupport,
        connection_type: connectionType,
        payload: { eventType, ...payload },
        last_seen_at: new Date().toISOString(),
      };
      const sessionErr = await storeWithConversationFallback({
        table: "visitor_sessions",
        row: sessionRow,
        fallbackSessionId,
        anonymousVisitorId,
        source: "visitor_session",
        fallbackValue: sessionRow,
        onConflict: "session_id",
        mergeDuplicates: true,
      });
      if (sessionErr) return sessionErr;

      if (anonymousVisitorId) {
        const deviceRow = {
          anonymous_visitor_id: anonymousVisitorId,
          last_session_id: fallbackSessionId,
          last_route: route,
          user_agent: server.userAgent,
          ip_address: server.ipAddress,
          forwarded_for: server.forwardedFor,
          country: server.country,
          region: server.region,
          city: server.city,
          latitude: server.latitude,
          longitude: server.longitude,
          server_timezone: server.timezone,
          device_kind: deviceKind,
          browser_name: browserName,
          os_name: osName,
          viewport,
          screen,
          language,
          client_timezone: timezone,
          platform,
          touch_support: touchSupport,
          connection_type: connectionType,
          payload,
          last_seen_at: new Date().toISOString(),
        };
        const deviceErr = await storeWithConversationFallback({
          table: "visitor_devices",
          row: deviceRow,
          fallbackSessionId,
          anonymousVisitorId,
          source: "visitor_device",
          fallbackValue: deviceRow,
          onConflict: "anonymous_visitor_id",
          mergeDuplicates: true,
        });
        if (deviceErr) return deviceErr;
      }
      return Response.json({ ok: true });
    }

    if (category === "action") {
      const actionType = cleanString(body?.actionType, 120) ?? "app_action";
      const actionTarget = cleanString(body?.actionTarget, 220);
      const actionRow = {
        session_id: fallbackSessionId,
        anonymous_visitor_id: anonymousVisitorId,
        action_type: actionType,
        action_target: actionTarget,
        route,
        viewport,
        payload,
      };
      const err = await storeWithConversationFallback({
        table: "visitor_actions",
        row: actionRow,
        fallbackSessionId,
        anonymousVisitorId,
        source: "visitor_action",
        fallbackValue: actionRow,
      });
      if (err) return err;
      return Response.json({ ok: true });
    }

    if (category === "list_state") {
      const action = cleanString(body?.action, 80) ?? "update";
      const list = safeJsonPayload(body?.list);
      const ui = safeJsonPayload(body?.ui);
      const row = {
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId,
        client_list_id: cleanString(list.id, 160),
        title: cleanString(list.title, 220),
        kind: cleanString(list.kind, 80),
        action: LIST_ACTIONS.has(action) ? action : "update",
        item_count:
          typeof list.itemCount === "number" && Number.isFinite(list.itemCount)
            ? Math.max(0, Math.floor(list.itemCount))
            : Array.isArray(list.items)
              ? list.items.length
              : null,
        items: Array.isArray(list.items) ? list.items.slice(0, 80) : [],
        active_list_id: cleanString(ui.activeListId, 160),
        is_visible: typeof ui.isVisible === "boolean" ? ui.isVisible : null,
        is_shopping_mode:
          typeof ui.isShoppingMode === "boolean" ? ui.isShoppingMode : null,
        route,
        viewport,
        deployment_url: server.deploymentUrl,
        device_kind: deviceKind,
        browser_name: browserName,
        os_name: osName,
        ip_address: server.ipAddress,
        country: server.country,
        region: server.region,
        city: server.city,
        payload,
      };
      const err = await storeWithConversationFallback({
        table: "assistant_list_events",
        row,
        fallbackSessionId,
        anonymousVisitorId,
        source: "list_state_event",
        fallbackValue: row,
      });
      if (err) return err;
      return Response.json({ ok: true });
    }

    if (category === "feedback") {
      const phrase = cleanString(body?.phrase, MAX_TEXT_CHARS);
      if (!phrase) {
        return new Response(JSON.stringify({ error: "phrase is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const row = {
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId,
        sentiment: cleanSentiment(body?.sentiment),
        severity: cleanSeverity(body?.severity, "medium"),
        phrase,
        route,
        viewport,
        active_sticky_note:
          cleanString(body?.activeStickyNote, 160) ??
          cleanString(body?.activeList, 160),
        visible_items: cleanStringArray(body?.visibleItems, 40),
        sticky_note_index:
          typeof body?.stickyNoteIndex === "number"
            ? body.stickyNoteIndex
            : typeof body?.listIndex === "number"
              ? body.listIndex
              : null,
        sticky_note_count:
          typeof body?.stickyNoteCount === "number"
            ? body.stickyNoteCount
            : typeof body?.listCount === "number"
              ? body.listCount
              : null,
        recent_actions: cleanStringArray(body?.recentActions, 20),
        mode: cleanString(body?.mode, 80) ?? "full-liveavatar",
        payload,
      };
      const err = await storeWithConversationFallback({
        table: "feedback_events",
        row,
        fallbackSessionId,
        anonymousVisitorId,
        source: "product_feedback",
        fallbackValue: {
          category: "feedback",
          phrase,
          sentiment: row.sentiment,
          severity: row.severity,
          payload,
        },
      });
      if (err) return err;
      return Response.json({ ok: true });
    }

    if (category === "preference") {
      const signal = cleanString(body?.signal, MAX_TEXT_CHARS);
      if (!signal) {
        return new Response(JSON.stringify({ error: "signal is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const row = {
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId,
        category: cleanString(body?.preferenceCategory, 80) ?? "preference",
        signal,
        source_text: cleanString(body?.sourceText, MAX_TEXT_CHARS),
        confidence:
          typeof body?.confidence === "number" &&
          Number.isFinite(body.confidence)
            ? body.confidence
            : null,
        payload,
      };
      const err = await storeWithConversationFallback({
        table: "preference_candidates",
        row,
        fallbackSessionId,
        anonymousVisitorId,
        source: "preference_candidate",
        fallbackValue: {
          category: "preference",
          signal,
          sourceText: row.source_text,
          payload,
        },
      });
      if (err) return err;
      return Response.json({ ok: true });
    }

    const row = {
      session_id: sessionId,
      anonymous_visitor_id: anonymousVisitorId,
      event_type: cleanString(body?.eventType, 120) ?? "app_event",
      severity: cleanSeverity(body?.severity, "low"),
      provider: cleanString(body?.provider, 80),
      route,
      status_code: cleanStatusCode(body?.statusCode),
      user_visible_state: cleanString(body?.userVisibleState, 240),
      payload,
    };
    const err = await storeWithConversationFallback({
      table: "app_events",
      row,
      fallbackSessionId,
      anonymousVisitorId,
      source: "app_event",
      fallbackValue: {
        category: "app",
        eventType: row.event_type,
        severity: row.severity,
        provider: row.provider,
        route,
        statusCode: row.status_code,
        userVisibleState: row.user_visible_state,
        payload,
      },
    });
    if (err) return err;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error storing app event:", error);
    return new Response(JSON.stringify({ error: "Failed to store app event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
