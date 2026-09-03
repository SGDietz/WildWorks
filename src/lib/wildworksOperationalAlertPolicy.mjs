const TELEMETRY_FAILURES = new Map([
  ["liveavatar_token_failed", ["avatar_initialization", "iScott token"]],
  ["liveavatar_token_exception", ["avatar_initialization", "iScott token"]],
  ["liveavatar_session_proxy_failed", ["avatar_provider", "iScott session"]],
  ["liveavatar_transcript_sync_failed", ["avatar_provider", "iScott transcript sync"]],
  ["liveavatar_session_store_failed", ["supabase_database", "iScott session store"]],
  ["liveavatar_transcript_store_failed", ["supabase_database", "iScott transcript store"]],
  ["public_message_notification_failed", ["lead_delivery", "iScott notification"]],
  ["iscott_lead_capture_failed", ["supabase_database", "iScott lead capture"]],
  ["iscott_lead_confirmation_failed", ["lead_delivery", "iScott lead confirmation"]],
  ["iscott_media_store_failed", ["supabase_storage", "iScott media storage"]],
  ["iscott_media_metadata_failed", ["supabase_storage", "iScott media metadata"]],
  ["iscott_media_capture_exception", ["upload_failure", "iScott media capture"]],
  ["avatar_image_analysis_failed", ["upload_failure", "iScott image analysis"]],
  ["avatar_video_analysis_failed", ["upload_failure", "iScott video analysis"]],
  ["marketing_signup_store_failed", ["supabase_database", "marketing signup"]],
  ["marketing_signup_delivery_failed", ["lead_delivery", "marketing signup"]],
  ["marketing_signup_exception", ["lead_submission", "marketing signup"]],
  ["voice_email_drain_failed", ["background_job", "voice email drain"]],
  ["telemetry_digest_failed", ["background_job", "telemetry digest"]],
  ["liveavatar_transcript_sync_skipped_supabase_missing", ["supabase_configuration", "iScott transcript storage"]],
  ["supabase_configuration_failed", ["supabase_configuration", "Supabase"]],
]);

export function compactSafeText(value, max = 160) {
  return String(value ?? "unknown")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone]")
    .replace(/(?:bearer|token|key|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || "unknown";
}

export function safeRoute(value) {
  const text = String(value ?? "/").split(/[?#]/, 1)[0];
  return /^\/[A-Za-z0-9_./-]*$/.test(text) ? text.slice(0, 180) : "/unknown";
}

export function correlationId(value) {
  const source = String(value ?? "uncorrelated");
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code ^ index, 0x85ebca6b) >>> 0;
  }
  return `ww-${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0").slice(0, 4)}`;
}

export function classifyOperationalTelemetryEvent(args) {
  const eventType = String(args?.eventType ?? "");
  if (eventType === "liveavatar_transcript_sync_failed"
    && Number(args?.statusCode) === 404
    && Number(args?.failStreak ?? 0) < 3) return null;
  const match = TELEMETRY_FAILURES.get(eventType);
  if (!match) return null;
  const [category, component] = match;
  const status = Number.isInteger(args?.statusCode) ? `HTTP ${args.statusCode}` : "failure";
  const provider = compactSafeText(args?.provider ?? "local", 40);
  return {
    category,
    component,
    route: safeRoute(args?.route),
    correlationId: correlationId(args?.sessionId ?? `${eventType}:${args?.route ?? "unknown"}`),
    summary: `${eventType}; ${provider}; ${status}`,
  };
}

export function formatOperationalAlert(args, timestamp = new Date().toISOString()) {
  return [
    "WildWorks operational failure",
    `time: ${timestamp}`,
    `category: ${compactSafeText(args.category, 60)}`,
    `component: ${compactSafeText(args.component, 80)}`,
    `route: ${safeRoute(args.route)}`,
    `correlation: ${compactSafeText(args.correlationId, 40)}`,
    `summary: ${compactSafeText(args.summary, 180)}`,
  ].join("\n");
}

export function classifySupabaseOperationalFailure(args) {
  const statusCode = Number.isInteger(args?.statusCode) ? Number(args.statusCode) : 0;
  const operation = compactSafeText(args?.operation, 80);
  const component = compactSafeText(args?.component, 80);
  if (statusCode === 409
    && /voice email outbox/i.test(component)
    && /^POST voice_email_outbox\b/i.test(operation)) return null;
  const category = args?.failureKind === "configuration"
    ? "supabase_configuration"
    : statusCode === 401 || statusCode === 403
    ? "supabase_auth"
    : /storage|bucket|object/i.test(operation)
      ? "supabase_storage"
      : statusCode === 0
        ? "supabase_connectivity"
        : statusCode >= 500
          ? "supabase_service"
        : "supabase_database";
  return {
    category,
    component,
    route: "/internal/supabase",
    correlationId: correlationId(args?.correlationSource ?? `${component}:${operation}:${statusCode}`),
    summary: `Supabase ${operation}; ${statusCode ? `HTTP ${statusCode}` : "unavailable"}`,
  };
}

export function createConnectivityMissGate({ threshold = 2, windowMs = 60_000 } = {}) {
  const misses = new Map();
  return (args, now = Date.now()) => {
    const key = compactSafeText(args?.key ?? "supabase-connectivity", 160);
    if (!args?.connectivity) {
      misses.delete(key);
      return true;
    }
    const previous = misses.get(key);
    const count = previous && now - previous.at <= windowMs ? previous.count + 1 : 1;
    if (count >= threshold) {
      misses.delete(key);
      return true;
    }
    misses.set(key, { count, at: now });
    return false;
  };
}
