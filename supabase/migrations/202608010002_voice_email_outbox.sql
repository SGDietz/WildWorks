-- Durable, server-only email notifications for WildWorks voice leads and voicemail.

create table if not exists public.voice_email_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  event_type text not null
    check (event_type in ('voice_lead', 'voicemail')),
  session_id text,
  external_call_id text,
  recipient text,
  subject text not null,
  text_body text not null,
  html_body text,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  provider text not null default 'resend',
  provider_message_id text,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.voice_email_outbox is
  'Server-only outbox for retry-safe WildWorks voice lead and voicemail email notifications.';

comment on column public.voice_email_outbox.idempotency_key is
  'Stable event key reused for both database and email-provider deduplication.';

create unique index if not exists uq_voice_email_outbox_idempotency_key
  on public.voice_email_outbox (idempotency_key);

create unique index if not exists uq_voice_email_outbox_provider_message_id
  on public.voice_email_outbox (provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_voice_email_outbox_retry
  on public.voice_email_outbox (created_at)
  where status in ('pending', 'failed');

create index if not exists idx_voice_email_outbox_session_id
  on public.voice_email_outbox (session_id)
  where session_id is not null;

create index if not exists idx_voice_email_outbox_external_call_id
  on public.voice_email_outbox (external_call_id)
  where external_call_id is not null;

alter table public.voice_email_outbox enable row level security;
