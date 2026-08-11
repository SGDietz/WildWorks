-- Durable iScott website lead capture, confirmation, media linkage, and email delivery.

create table if not exists public.iscott_leads (
  session_id text primary key,
  anonymous_visitor_id text,
  source_route text,
  status text not null default 'capturing'
    check (status in ('capturing', 'ready_for_confirmation', 'confirmed', 'submitted', 'declined')),
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'accepted', 'declined')),
  full_name text,
  location text,
  project_need text,
  contact_method text
    check (contact_method is null or contact_method in ('email', 'phone')),
  email text,
  phone text,
  contact_confirmed_at timestamptz,
  submitted_at timestamptz,
  notification_outbox_id uuid references public.voice_email_outbox(id) on delete set null,
  notification_status text,
  transcript_text text,
  transcript_snapshot jsonb not null default '[]'::jsonb,
  media_snapshot jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_iscott_leads_created_at
  on public.iscott_leads (created_at desc);

create index if not exists idx_iscott_leads_status
  on public.iscott_leads (status, updated_at desc);

create index if not exists idx_iscott_leads_email
  on public.iscott_leads (lower(email))
  where email is not null;

create index if not exists idx_iscott_leads_phone
  on public.iscott_leads (phone)
  where phone is not null;

create table if not exists public.iscott_media (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  client_session_id text,
  upload_id text not null unique,
  bucket text not null,
  object_path text not null unique,
  original_name text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  source_route text,
  viewport text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_iscott_media_session_id
  on public.iscott_media (session_id, created_at asc);

create index if not exists idx_iscott_media_client_session_id
  on public.iscott_media (client_session_id, created_at asc);

alter table public.voice_email_outbox
  drop constraint if exists voice_email_outbox_event_type_check;

alter table public.voice_email_outbox
  add constraint voice_email_outbox_event_type_check
    check (event_type in ('voice_lead', 'voicemail', 'voice_ops_alert', 'iscott_lead'));

alter table public.iscott_leads enable row level security;
alter table public.iscott_media enable row level security;

comment on table public.iscott_leads is
  'One consolidated, confirmed sales-lead package per iScott LiveAvatar session.';

comment on table public.iscott_media is
  'Private iScott photo and video uploads linked to a LiveAvatar or client session.';
