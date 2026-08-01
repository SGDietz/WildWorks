# WildWorks voice route contract

These routes are staged code only. This file does not authorize a deploy, a
Twilio webhook change, or a production cron schedule.

## Runtime events

`POST /api/internal/voice-events` accepts JSON version `1` with:

`eventId`, `eventType`, `occurredAt`, `callSid`, `sessionId`, optional
`messageId`, `text`, `summary`, `callerName`, `callerPhone`, and `metadata`.

Supported event types are `session_start`, `user_message`,
`assistant_message`, `handoff`, and `session_end`. Message IDs and event IDs
are the durable idempotency keys. `session_end` queues one lead email keyed by
the Twilio Call SID; the signed ConversationRelay action uses the same logical
key as a fallback, so the two paths cannot send duplicate lead notices.

The service sends:

- `X-WildWorks-Voice-Timestamp`: current Unix seconds
- `X-WildWorks-Voice-Signature`: `v1=` plus lowercase HMAC-SHA256 hex over
  `${timestamp}.${exactRawUtf8Body}`

Both sides use the same `WILDWORKS_VOICE_EVENT_SECRET`, which must be at least
32 bytes. Requests outside the five-minute replay window are rejected.

`HEAD /api/internal/voice-events` is a non-mutating readiness probe. It uses
the same two headers and signs `${timestamp}.` (an empty body). It returns 204
only when the required Supabase session, message, call-context, and email
outbox tables are reachable with the server credentials; otherwise it returns
503. A bad signature returns 403.

## Voicemail

Twilio signs `/api/voice/incoming`, `/recording-complete`, and
`/transcription-complete` with its standard `X-Twilio-Signature` and the exact
public callback URL. The incoming route saves `From` by `CallSid`, because the
recording-status callback does not include caller identity.

`<Record>` is capped at 119 seconds and requests Twilio native transcription.
Twilio only transcribes recordings longer than two seconds and shorter than
120 seconds. The recording callback only persists context. The transcription
callback queues the transcript email. If that callback never arrives, the
authenticated drain route sends a clearly labeled delayed fallback after
`WILDWORKS_VOICE_TRANSCRIPTION_GRACE_SECONDS`.

Email recording links never expose Twilio credentials or a raw RecordingUrl.
They are HMAC-signed, expire after `WILDWORKS_VOICE_PLAYBACK_TTL_SECONDS`, and
proxy the selected Recording SID server-side using `TWILIO_ACCOUNT_SID` and
`TWILIO_AUTH_TOKEN`.

## Retry drain

`GET` or `POST /api/internal/voice-email-drain` requires:

`Authorization: Bearer <WILDWORKS_VOICE_CRON_SECRET>`

`CRON_SECRET` is accepted as an alternative for Vercel Cron. The cron/event,
playback, and Twilio secrets must all be distinct. The drain uses database CAS
leases, recovers stale `sending` rows, applies bounded exponential backoff,
and uses the email provider idempotency key. The Vercel Hobby cron is a daily
backstop. The always-on Render voice service is responsible for an authenticated
five-minute maintenance POST so retries and missing-transcript fallbacks do not
wait for the daily cron.
