# iScott Voice Service

Isolated Node/TypeScript service for Twilio ConversationRelay WebSockets. It is
not attached to the WildWorks telephone number and is not deployed by this
directory.

## Non-negotiable routing

- Press 1 may enter AI only after the Twilio consent menu records affirmative
  DTMF consent.
- Press 2, AI unavailable, provider error, budget failure, caller request for a
  person, and graceful-shutdown expiry all return `target: voicemail` to the
  signed Twilio flow.
- "Voicemail" means the separate WildWorks/Twilio business voicemail. This
  service contains no personal telephone number, `<Dial>`, carrier voicemail,
  or automatic direct-cell route.
- The service emits text to ConversationRelay. ElevenLabs voice selection and
  synthesis belong in the reviewed Twilio/TwiML ConversationRelay settings,
  not in this service. There are intentionally no ElevenLabs credentials here.

## Local verification

```powershell
cd services/iscott-voice
Copy-Item .env.example .env
npm ci
npm test
npm run typecheck
npm run build
npm run start:dev
```

`AI_ENABLED` defaults to `false`. Enabling it requires an HTTPS
`LLM_ENDPOINT_URL` (for OpenAI chat completions, normally
`https://api.openai.com/v1/chat/completions`), `LLM_API_KEY`, and `LLM_MODEL`.
Production locks this to the exact OpenAI chat-completions endpoint so a
configuration mistake cannot send a caller transcript to another host.

## Production daily budget

Production refuses to start unless `BUDGET_BACKEND=supabase` and the Supabase
URL and service-role secret are present. Apply the repository's numbered
`supabase/migrations/202608010005_iscott_voice_budget.sql` migration through
the normal Supabase migration flow. It creates a private counter table plus the service-role-only
`reserve_iscott_voice_daily_usage` RPC.

Every call, prompt, and output-character reservation is an atomic RPC. A
timeout, HTTP/auth error, missing RPC, or malformed grant fails closed to
business voicemail before additional AI work. The `/healthz` Render readiness
probe performs a zero-unit RPC reservation and an authenticated, non-mutating
HEAD probe of the WildWorks event receiver. An instance with broken budget,
persistence, or notification storage receives HTTP 503 instead of new calls.
The in-memory counter is available only in development and tests.

## Durable runtime events

Production also refuses to start without `WILDWORKS_VOICE_EVENT_URL` and a
shared `WILDWORKS_VOICE_EVENT_SECRET` of at least 32 UTF-8 bytes. It also
requires a distinct `WILDWORKS_VOICE_CRON_SECRET` matching Vercel. The URL must
be HTTPS and its path must be exactly `/api/internal/voice-events`; only a
loopback HTTP URL is allowed during local development or tests. Production
also locks the receiver host to `wildworks.live` or `www.wildworks.live`.

The service posts one JSON v1 event for `session_start`, every final
`user_message`, every completed `assistant_message`, `handoff`, and
`session_end`. It maps the ConversationRelay setup `from` value to
`callerPhone` and places `to` in `metadata.to`. Handoff and end reasons are in
`metadata.reason`, with `metadata.target` always either `voicemail` or `none`.
Message and event IDs are deterministic SHA-256 idempotency keys and expose no
raw content.

The always-on service also makes one non-overlapping, authenticated POST to
`/api/internal/voice-email-drain` every five minutes. Failed attempts use
bounded exponential backoff with jitter. This provides prompt email retry and
missing-transcription fallback while the Vercel daily cron remains a separate
backup.

Each exact raw JSON body is authenticated with:

- `X-WildWorks-Voice-Timestamp`: current Unix seconds
- `X-WildWorks-Voice-Signature`: `v1=` plus lowercase HMAC-SHA256 hex over
  `${timestamp}.${rawBody}` using `WILDWORKS_VOICE_EVENT_SECRET`

The receiver must reject timestamps outside a five-minute replay window before
accepting the event and must deduplicate by `eventId`/`messageId`.

Delivery has a per-attempt timeout and a small bounded retry count. Redirects
are rejected. A missing `session_start`, final caller message, or completed
assistant message is a hard persistence gate: the service stops further AI
work and hands the caller to the separate WildWorks business voicemail. This
prevents an untracked AI conversation or uncontrolled spend without dropping
the caller. Terminal `handoff` and `session_end` reports are bounded best
effort because the call is already ending; their failure never creates a
personal-phone route and never delays the Twilio handoff.

## Render paid always-on service

`Dockerfile` produces a small non-root Node runtime after tests, typecheck, and
compile succeed. `render.yaml` defines a paid `starter` Web Service in Virginia,
HTTP health checks at `/healthz`, manual deploys, one instance, and a 130-second
maximum shutdown delay. The service binds Render's `PORT` on `0.0.0.0` and uses
the same public port for HTTP and WebSocket upgrades.

Use the Blueprint at `services/iscott-voice/render.yaml` (or enter those exact
settings in Render). Add secrets only in Render:

- `PUBLIC_WSS_URL` — exact `wss://...` ConversationRelay path on the assigned
  Render host; scheme, host, path, query, and slash must match Twilio exactly.
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
- `LLM_ENDPOINT_URL`, `LLM_API_KEY`, and `LLM_MODEL` before turning AI on.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `WILDWORKS_VOICE_EVENT_URL` and `WILDWORKS_VOICE_EVENT_SECRET` for the
  authenticated Vercel persistence endpoint.
- `WILDWORKS_VOICE_CRON_SECRET`, distinct from the event secret, for the
  authenticated five-minute email-maintenance trigger.

The Blueprint deliberately leaves `AI_ENABLED=false` and automatic deploys off.
Turn AI on only after the staged Press 1, Press 2, voicemail, email, budget, and
AI-failure call tests pass.

## Authentication and shutdown

WebSocket authentication is two-stage:

1. The upgrade must have a valid `X-Twilio-Signature`, verified by Twilio's
   official SDK for the exact `PUBLIC_WSS_URL`.
2. The first ConversationRelay setup frame's `accountSid` must match the
   configured Twilio Account SID.

On Render `SIGTERM`, `/healthz` changes to 503 and new upgrades receive 503.
Existing calls can finish for the configured call cap (maximum 120 seconds).
At expiry, every remaining session receives an `end` frame whose handoff target
is business voicemail, gets a short frame-delivery grace period, and only then
has its transport terminated. `render.yaml` reserves 130 seconds so this fits
inside Render's shutdown window.

## Remaining live blockers

Nothing in this directory performs a deploy or changes Twilio. Before a live
switch, all of the following still have to happen outside this service:

1. Apply migration `202608010005_iscott_voice_budget.sql` and verify the RPC
   with the deployed secret.
2. Create the paid Render Web Service and enter the secret environment values.
3. Deploy, confirm `/healthz` is 200, and set the exact assigned WSS URL.
4. Configure Twilio/TwiML ConversationRelay and ElevenLabs voice settings to use
   that WSS URL; keep the business-voicemail handoff branch in Twilio.
5. Configure the separate voicemail/email notification path.
6. Configure and verify the authenticated runtime-event endpoint and its
   session/message idempotency behavior.
7. Stage and call-test Press 1, Press 2, AI error, shared-budget failure, Render
   shutdown, voicemail recording, and email delivery before changing the live
   877 route.
