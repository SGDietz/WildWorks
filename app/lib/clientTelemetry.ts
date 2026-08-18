export type TelemetryCategory = "session" | "action" | "app" | "feedback" | "preference";

const VISITOR_KEY = "wildworks.anonymousVisitorId";
const SESSION_KEY = "wildworks.clientSessionId";

function safeRandomId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${random}`.slice(0, 120);
}

function getStorageValue(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageValue(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage-disabled browsers; event payload still includes in-memory IDs.
  }
}

let memoryVisitorId: string | null = null;
let memorySessionId: string | null = null;

export function getAnonymousVisitorId() {
  if (memoryVisitorId) return memoryVisitorId;
  const existing = getStorageValue(window.localStorage, VISITOR_KEY);
  memoryVisitorId = existing || safeRandomId("wwv");
  if (!existing) setStorageValue(window.localStorage, VISITOR_KEY, memoryVisitorId);
  return memoryVisitorId;
}

export function getClientSessionId() {
  if (memorySessionId) return memorySessionId;
  const existing = getStorageValue(window.sessionStorage, SESSION_KEY);
  memorySessionId = existing || safeRandomId("wws");
  if (!existing) setStorageValue(window.sessionStorage, SESSION_KEY, memorySessionId);
  return memorySessionId;
}

function getDevicePayload() {
  if (typeof window === "undefined") return {};
  const nav = window.navigator as Navigator & { connection?: { effectiveType?: string; type?: string } };
  const screenValue = window.screen ? `${window.screen.width}x${window.screen.height}x${window.devicePixelRatio || 1}` : null;
  return {
    language: nav.language || null,
    platform: nav.platform || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    screen: screenValue,
    touchSupport: "ontouchstart" in window || nav.maxTouchPoints > 0,
    connectionType: nav.connection?.effectiveType || nav.connection?.type || null,
    deviceKind: /Mobi|Android|iPhone|iPad|iPod/i.test(nav.userAgent) ? "mobile" : "desktop",
    browserName: nav.userAgent,
    osName: nav.platform || null,
  };
}

function viewport() {
  if (typeof window === "undefined") return null;
  return `${window.innerWidth}x${window.innerHeight}`;
}

export function buildTelemetryBody(extra: Record<string, unknown>) {
  return {
    sessionId: getClientSessionId(),
    clientSessionId: getClientSessionId(),
    anonymousVisitorId: getAnonymousVisitorId(),
    route: typeof window !== "undefined" ? window.location.pathname : null,
    viewport: viewport(),
    device: getDevicePayload(),
    ...extra,
  };
}

export function logTelemetryEvent(extra: Record<string, unknown>, options: { keepalive?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const body = buildTelemetryBody(extra);
  const serialized = JSON.stringify(body);
  if (options.keepalive && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([serialized], { type: "application/json" });
      if (navigator.sendBeacon("/api/app-events/log", blob)) return;
    } catch {
      // Fall through to fetch.
    }
  }
  void fetch("/api/app-events/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serialized,
    keepalive: options.keepalive,
  }).catch(() => {});
}
