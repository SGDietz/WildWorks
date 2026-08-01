-- Provider identifiers used to make inbound voice persistence retry-safe.
-- Existing browser/LiveAvatar rows remain valid because both columns are nullable.

alter table public.conversation_sessions
  add column if not exists external_call_id text;

alter table public.conversation_messages
  add column if not exists provider_message_id text;

comment on column public.conversation_sessions.external_call_id is
  'Stable call identifier assigned by the voice provider (for example, a Twilio Call SID).';

comment on column public.conversation_messages.provider_message_id is
  'Stable provider event or message identifier used to deduplicate retried voice transcript messages.';

create unique index if not exists uq_conversation_sessions_external_call_id
  on public.conversation_sessions (external_call_id)
  where external_call_id is not null;

create unique index if not exists uq_conversation_messages_provider_message_id
  on public.conversation_messages (provider_message_id)
  where provider_message_id is not null;
