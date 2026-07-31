-- WildWorks Supabase telemetry schema.
-- Server routes write with SUPABASE_SERVICE_ROLE_KEY; no public RLS write policies are created.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wildworks-telemetry',
  'wildworks-telemetry',
  false,
  1048576,
  array['application/json']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.conversation_sessions (
  session_id text primary key,
  liveavatar_session_id text,
  anonymous_visitor_id text,
  route text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'liveavatar',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  anonymous_visitor_id text,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  la_absolute_timestamp bigint,
  source text not null default 'app',
  route text,
  viewport text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, role, la_absolute_timestamp)
);

alter table public.conversation_messages
  add column if not exists anonymous_visitor_id text,
  add column if not exists route text,
  add column if not exists viewport text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.transcript_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  transcript text not null,
  extracted_email text,
  extracted_phone text,
  extracted_name text,
  follow_up_intent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  event_type text not null,
  severity text not null default 'low'
    check (severity in ('critical', 'high', 'medium', 'low')),
  provider text,
  route text,
  status_code integer,
  user_visible_state text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  sentiment text not null check (sentiment in ('negative', 'positive')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  phrase text not null,
  route text,
  viewport text,
  active_sticky_note text,
  visible_items jsonb not null default '[]'::jsonb,
  sticky_note_index integer,
  sticky_note_count integer,
  recent_actions jsonb not null default '[]'::jsonb,
  mode text not null default 'full-liveavatar',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.preference_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  category text not null default 'preference',
  signal text not null,
  source_text text,
  confidence numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  anonymous_visitor_id text,
  route text,
  deployment_url text,
  referrer text,
  origin text,
  user_agent text,
  ip_address text,
  forwarded_for text,
  country text,
  region text,
  city text,
  latitude text,
  longitude text,
  server_timezone text,
  device_kind text,
  browser_name text,
  os_name text,
  viewport text,
  screen text,
  language text,
  client_timezone text,
  platform text,
  touch_support boolean,
  connection_type text,
  payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.visitor_devices (
  id uuid primary key default gen_random_uuid(),
  anonymous_visitor_id text not null unique,
  last_session_id text,
  last_route text,
  user_agent text,
  ip_address text,
  forwarded_for text,
  country text,
  region text,
  city text,
  latitude text,
  longitude text,
  server_timezone text,
  device_kind text,
  browser_name text,
  os_name text,
  viewport text,
  screen text,
  language text,
  client_timezone text,
  platform text,
  touch_support boolean,
  connection_type text,
  payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.visitor_actions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  anonymous_visitor_id text,
  action_type text not null,
  action_target text,
  route text,
  viewport text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_list_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  client_list_id text,
  title text,
  kind text,
  action text not null,
  item_count integer,
  items jsonb not null default '[]'::jsonb,
  active_list_id text,
  is_visible boolean,
  is_shopping_mode boolean,
  route text,
  viewport text,
  deployment_url text,
  device_kind text,
  browser_name text,
  os_name text,
  ip_address text,
  country text,
  region text,
  city text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_sessions_started_at on public.conversation_sessions (started_at desc);
create index if not exists idx_conversation_messages_session_id on public.conversation_messages (session_id);
create index if not exists idx_conversation_messages_created_at on public.conversation_messages (created_at desc);
create index if not exists idx_conversation_messages_anonymous_visitor on public.conversation_messages (anonymous_visitor_id);
create index if not exists idx_conversation_messages_message_trgm on public.conversation_messages using gin (message gin_trgm_ops);
create index if not exists idx_transcript_events_session_id on public.transcript_events (session_id);
create index if not exists idx_transcript_events_created_at on public.transcript_events (created_at desc);
create index if not exists idx_app_events_created_at on public.app_events (created_at desc);
create index if not exists idx_app_events_session_id on public.app_events (session_id);
create index if not exists idx_app_events_type_severity on public.app_events (event_type, severity);
create index if not exists idx_feedback_events_created_at on public.feedback_events (created_at desc);
create index if not exists idx_feedback_events_session_id on public.feedback_events (session_id);
create index if not exists idx_feedback_events_severity on public.feedback_events (severity);
create index if not exists idx_preference_candidates_created_at on public.preference_candidates (created_at desc);
create index if not exists idx_preference_candidates_session_id on public.preference_candidates (session_id);
create index if not exists idx_visitor_sessions_last_seen on public.visitor_sessions (last_seen_at desc);
create index if not exists idx_visitor_sessions_anonymous_visitor on public.visitor_sessions (anonymous_visitor_id);
create index if not exists idx_visitor_devices_last_seen on public.visitor_devices (last_seen_at desc);
create index if not exists idx_visitor_actions_session_id on public.visitor_actions (session_id);
create index if not exists idx_visitor_actions_created_at on public.visitor_actions (created_at desc);
create index if not exists idx_visitor_actions_type on public.visitor_actions (action_type);
create index if not exists idx_assistant_list_events_session_id on public.assistant_list_events (session_id);
create index if not exists idx_assistant_list_events_created_at on public.assistant_list_events (created_at desc);
create index if not exists idx_assistant_list_events_action on public.assistant_list_events (action);

alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.transcript_events enable row level security;
alter table public.app_events enable row level security;
alter table public.feedback_events enable row level security;
alter table public.preference_candidates enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.visitor_devices enable row level security;
alter table public.visitor_actions enable row level security;
alter table public.assistant_list_events enable row level security;
