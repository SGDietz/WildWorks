-- Code-only. Do not apply from this packet.
-- L98: durable, queryable error log for iScott send/sync/provider failures.
-- L97 surfaces resend_send_failed on the overlay; this table is the operator view.

create table if not exists public.iscott_error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text,
  event_type text not null,
  route text,
  status_code integer,
  message text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists iscott_error_log_session_created_idx
  on public.iscott_error_log (session_id, created_at desc);

create index if not exists iscott_error_log_event_created_idx
  on public.iscott_error_log (event_type, created_at desc);

comment on table public.iscott_error_log is
  'Usable iScott error log. Overlay already shows send/sync failures; do not apply until Chief installs.';
