import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  classifyOperationalTelemetryEvent,
  classifySupabaseOperationalFailure,
  createConnectivityMissGate,
  compactSafeText,
  correlationId,
  formatOperationalAlert,
  safeRoute,
} from "./wildworksOperationalAlertPolicy.mjs";

type OperationalAlert = {
  category: string;
  component: string;
  route: string;
  correlationId: string;
  summary: string;
};

const execFileAsync = promisify(execFile);
const recentAlerts = new Map<string, number>();
const sentTimes: number[] = [];
const DEDUPE_MS = 10 * 60 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
let configPromise: Promise<{ token: string; chatId: string } | null> | null = null;
const admitConnectivity = createConnectivityMissGate({ threshold: 2, windowMs: 60_000 });

async function loadAlertConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const environmentToken = process.env.TELEGRAM_ALERT_BOT_TOKEN?.trim() ?? "";
      const environmentChatId = process.env.TELEGRAM_ALERT_CHAT_ID?.trim() ?? "";
      if (/^\d+:[A-Za-z0-9_-]{30,}$/.test(environmentToken) && /^-?\d{5,20}$/.test(environmentChatId)) {
        return { token: environmentToken, chatId: environmentChatId };
      }
      try {
        const script = path.join(process.cwd(), "ops", "Get-WildWorksTelegramAlertConfig.ps1");
        const { stdout } = await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-ExecutionPolicy", "Bypass",
          "-File", script,
        ], { timeout: 5_000, windowsHide: true, maxBuffer: 16_384 });
        const parsed = JSON.parse(stdout.trim()) as { token?: unknown; chatId?: unknown };
        if (typeof parsed.token !== "string" || typeof parsed.chatId !== "string") return null;
        return { token: parsed.token, chatId: parsed.chatId };
      } catch {
        return null;
      }
    })();
  }
  return configPromise;
}

function admit(key: string) {
  const now = Date.now();
  for (const [seenKey, seenAt] of recentAlerts) {
    if (now - seenAt > DEDUPE_MS) recentAlerts.delete(seenKey);
  }
  while (sentTimes.length && now - sentTimes[0] > WINDOW_MS) sentTimes.shift();
  if (recentAlerts.has(key) || sentTimes.length >= MAX_PER_WINDOW) return false;
  recentAlerts.set(key, now);
  sentTimes.push(now);
  return true;
}

export async function sendWildWorksOperationalAlert(alert: OperationalAlert) {
  const normalized = {
    category: compactSafeText(alert.category, 60),
    component: compactSafeText(alert.component, 80),
    route: safeRoute(alert.route),
    correlationId: compactSafeText(alert.correlationId, 40),
    summary: compactSafeText(alert.summary, 180),
  };
  const key = `${normalized.category}|${normalized.component}|${normalized.correlationId}`;
  if (!admit(key)) return { sent: false, reason: "suppressed" } as const;
  const config = await loadAlertConfig();
  if (!config) return { sent: false, reason: "not_configured" } as const;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text: formatOperationalAlert(normalized) }),
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));
    return response.ok
      ? { sent: true, reason: "sent" } as const
      : { sent: false, reason: "telegram_rejected" } as const;
  } catch {
    return { sent: false, reason: "telegram_unavailable" } as const;
  }
}

export function queueWildWorksOperationalAlert(alert: OperationalAlert) {
  void sendWildWorksOperationalAlert(alert).catch(() => undefined);
}

export function queueOperationalAlertFromTelemetry(args: {
  eventType: string;
  provider?: string | null;
  route?: string | null;
  statusCode?: number | null;
  sessionId?: string | null;
  failStreak?: number | null;
}) {
  const alert = classifyOperationalTelemetryEvent(args);
  if (alert) queueWildWorksOperationalAlert(alert);
}

export function queueUnhandledServerAlert(args: {
  error: unknown;
  route: string;
  component: string;
  correlationSource?: unknown;
}) {
  const error = args.error instanceof Error ? args.error : null;
  queueWildWorksOperationalAlert({
    category: "unhandled_server_error",
    component: compactSafeText(args.component, 80),
    route: safeRoute(args.route),
    correlationId: correlationId(args.correlationSource ?? error?.stack ?? args.route),
    summary: compactSafeText(error ? `${error.name}: ${error.message}` : "unknown server exception", 180),
  });
}

export function queueSupabaseOperationalAlert(args: {
  component: string;
  operation: string;
  statusCode?: number | null;
  correlationSource?: unknown;
  failureKind?: "configuration" | "connectivity";
}) {
  const alert = classifySupabaseOperationalFailure(args);
  if (!alert) return;
  if (alert.category === "supabase_connectivity" && !admitConnectivity({
    key: args.correlationSource ?? `${args.component}:${args.operation}`,
    connectivity: true,
  })) return;
  queueWildWorksOperationalAlert(alert);
}
