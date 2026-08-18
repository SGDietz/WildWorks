-- Server-owned traffic identity, classification, and visitor notification support.
-- Client payloads never choose their own traffic class.

create table if not exists public.visitor_identity_labels (
  anonymous_visitor_id text primary key,
  traffic_class text not null
    check (traffic_class in ('owner', 'test', 'public', 'bot')),
  label text,
  reason text not null,
  confidence numeric not null default 1
    check (confidence >= 0 and confidence <= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.visitor_identity_labels enable row level security;

alter table public.visitor_sessions
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

alter table public.visitor_devices
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

alter table public.visitor_actions
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

alter table public.conversation_sessions
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

alter table public.conversation_messages
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

alter table public.app_events
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visitor_sessions_traffic_class_check') then
    alter table public.visitor_sessions add constraint visitor_sessions_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visitor_devices_traffic_class_check') then
    alter table public.visitor_devices add constraint visitor_devices_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visitor_actions_traffic_class_check') then
    alter table public.visitor_actions add constraint visitor_actions_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conversation_sessions_traffic_class_check') then
    alter table public.conversation_sessions add constraint conversation_sessions_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conversation_messages_traffic_class_check') then
    alter table public.conversation_messages add constraint conversation_messages_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_events_traffic_class_check') then
    alter table public.app_events add constraint app_events_traffic_class_check check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
end $$;

create index if not exists idx_visitor_sessions_traffic_last_seen
  on public.visitor_sessions (traffic_class, last_seen_at desc);
create index if not exists idx_visitor_devices_traffic_last_seen
  on public.visitor_devices (traffic_class, last_seen_at desc);
create index if not exists idx_visitor_actions_traffic_created
  on public.visitor_actions (traffic_class, created_at desc);
create index if not exists idx_conversation_sessions_traffic_started
  on public.conversation_sessions (traffic_class, started_at desc);
create index if not exists idx_conversation_messages_traffic_created
  on public.conversation_messages (traffic_class, created_at desc);
create index if not exists idx_app_events_traffic_created
  on public.app_events (traffic_class, created_at desc);

-- High-confidence historical test/bot labels only. IP or location is never identity proof.
update public.visitor_devices
set traffic_class = 'test', traffic_reason = 'headless_browser', traffic_confidence = 1
where coalesce(user_agent, '') ~* '(HeadlessChrome|Playwright|Puppeteer)'
   or anonymous_visitor_id like 'codex-%';

update public.visitor_devices
set traffic_class = 'bot', traffic_reason = 'crawler_user_agent', traffic_confidence = 1
where traffic_class <> 'test'
  and coalesce(user_agent, '') ~* '(googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|meta-externalagent|crawler|spider|slurp)';

update public.visitor_sessions as session
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = session.anonymous_visitor_id;

update public.visitor_actions as action
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = action.anonymous_visitor_id;

update public.conversation_sessions as session
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = session.anonymous_visitor_id;

update public.conversation_messages as message
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = message.anonymous_visitor_id;

update public.app_events as event
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = event.anonymous_visitor_id;

alter table public.voice_email_outbox
  drop constraint if exists voice_email_outbox_event_type_check;

alter table public.voice_email_outbox
  add constraint voice_email_outbox_event_type_check
    check (event_type in (
      'voice_lead', 'voicemail', 'voice_ops_alert', 'iscott_lead',
      'telemetry_message', 'telemetry_digest'
    ));

comment on table public.visitor_identity_labels is
  'Server-only explicit identity labels. Owner and test enrollment must never be accepted from public client payloads.';

