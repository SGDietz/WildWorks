const SAFE_SESSION_TOKEN = /^[A-Za-z0-9._-]{20,4000}$/;

export function sessionTokenFromCookie(request: Request): string {
  const cookie = request.headers.get("cookie") || "";
  const pair = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("wildworks_iscott_session="));
  if (!pair) return "";
  try {
    return decodeURIComponent(pair.slice("wildworks_iscott_session=".length));
  } catch {
    return "";
  }
}

export async function ownsIScottSession(sessionId: string, sessionToken: string): Promise<boolean> {
  if (!SAFE_SESSION_TOKEN.test(sessionToken)) return false;
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceRoleKey) return false;
  const url = rawUrl.replace(/\/$/, "");
  const response = await fetch(
    `${url}/rest/v1/conversation_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=metadata&limit=1`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store" },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ metadata?: Record<string, unknown> | null }>;
  const stored = rows[0]?.metadata?.token_fp;
  if (typeof stored !== "string" || !/^[a-f0-9]{32}$/.test(stored)) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken));
  const supplied = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return stored === supplied;
}
