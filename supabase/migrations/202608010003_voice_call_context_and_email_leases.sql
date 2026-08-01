-- Server-only Twilio call context plus retry leases for the voice email outbox.

create table if not exists public.voice_call_context (
  call_sid text primary key,
  caller_phone text,
  recording_sid text unique,
  recording_status text,
  recording_duration integer,
  transcription_sid text,
  transcription_status text,
  transcription_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.voice_call_context is
  'Server-only bridge between Twilio call, recording, and transcription callbacks.';

alter table public.voice_call_context enable row level security;

alter table public.voice_email_outbox
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create index if not exists idx_voice_email_outbox_due
  on public.voice_email_outbox (next_attempt_at, updated_at)
  where status in ('pending', 'failed', 'sending');
