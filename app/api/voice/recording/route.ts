import { validateVoiceRecordingPlayback } from "@/src/lib/voiceRecordingPlayback";
import { voiceBackendSignal } from "@/src/lib/voiceFetchTimeouts";

export const runtime = "nodejs";

const ACCOUNT_SID_PATTERN = /^AC[0-9a-fA-F]{32}$/;

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const validation = validateVoiceRecordingPlayback(request);
  if (!validation.ok) {
    return plain(validation.reason === "expired" ? "This recording link has expired." : "Forbidden.", validation.reason === "expired" ? 410 : 403);
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!ACCOUNT_SID_PATTERN.test(accountSid) || !authToken) {
    return plain("Recording playback is not configured.", 503);
  }

  const range = request.headers.get("range")?.trim();
  const safeRange = range && /^bytes=\d*-\d*$/.test(range) ? range : null;
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${validation.recordingSid}.mp3`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`, "utf8").toString("base64")}`,
          ...(safeRange ? { Range: safeRange } : {}),
        },
        cache: "no-store",
        signal: voiceBackendSignal(5_000),
      },
    );
  } catch {
    return plain("Recording is temporarily unavailable.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return plain(upstream.status === 404 ? "Recording not found." : "Recording is temporarily unavailable.", upstream.status === 404 ? 404 : 502);
  }

  const headers = new Headers({
    "Content-Type": "audio/mpeg",
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["accept-ranges", "content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
