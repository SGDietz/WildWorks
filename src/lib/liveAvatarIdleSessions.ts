const LIVEAVATAR_IDLE_LIMIT_MS = 60_000;

type IdleSession = {
  apiUrl: string;
  token: string;
  timer: ReturnType<typeof setTimeout>;
};

declare global {
  var __wildworksLiveAvatarIdleSessions: Map<string, IdleSession> | undefined;
}

const sessions = globalThis.__wildworksLiveAvatarIdleSessions ?? new Map<string, IdleSession>();
globalThis.__wildworksLiveAvatarIdleSessions = sessions;

function schedule(session: IdleSession) {
  clearTimeout(session.timer);
  session.timer = setTimeout(async () => {
    sessions.delete(session.token);
    try {
      await fetch(`${session.apiUrl.replace(/\/$/, "")}/v1/sessions/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "USER_CLOSED" }),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[iScott] server idle stop failed", error);
    }
  }, LIVEAVATAR_IDLE_LIMIT_MS);
  session.timer.unref?.();
}

export function armLiveAvatarIdleSession(token: string, apiUrl: string) {
  const existing = sessions.get(token);
  if (existing) clearTimeout(existing.timer);
  const session: IdleSession = {
    apiUrl,
    token,
    timer: setTimeout(() => undefined, LIVEAVATAR_IDLE_LIMIT_MS),
  };
  sessions.set(token, session);
  schedule(session);
}

export function noteLiveAvatarSessionActivity(token: string) {
  const session = sessions.get(token);
  if (session) schedule(session);
}

export function clearLiveAvatarIdleSession(token: string) {
  const session = sessions.get(token);
  if (!session) return;
  clearTimeout(session.timer);
  sessions.delete(token);
}

export const liveAvatarIdleLimitMs = LIVEAVATAR_IDLE_LIMIT_MS;
