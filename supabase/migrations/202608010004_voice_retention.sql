-- Bounded, server-only retention controls for WildWorks voice data.
--
-- Policy encoded here:
--   * Twilio voicemail audio is eligible for provider deletion after 30 days.
--   * Raw voice transcripts, sessions, and caller context are removed after 365 days.
--   * Sent email content is scrubbed after 30 days.
--   * Unsent email receives 24-hour / 7-day operational escalation markers and
--     is dead-lettered and scrubbed after 90 days.
--   * retention_hold always wins over automatic cleanup.

begin;

alter table public.voice_call_context
  add column if not exists purge_after timestamptz,
  add column if not exists delete_after timestamptz,
  add column if not exists retention_hold boolean not null default false,
  add column if not exists recording_purge_lease_token uuid,
  add column if not exists recording_purge_lease_expires_at timestamptz,
  add column if not exists recording_purge_next_attempt_at timestamptz,
  add column if not exists recording_purge_attempt_count integer not null default 0,
  add column if not exists recording_purge_last_error text,
  add column if not exists recording_purged_at timestamptz;

update public.voice_call_context
set
  purge_after = coalesce(purge_after, created_at + interval '30 days'),
  delete_after = coalesce(delete_after, created_at + interval '365 days')
where purge_after is null or delete_after is null;

alter table public.voice_call_context
  alter column purge_after set default (now() + interval '30 days'),
  alter column delete_after set default (now() + interval '365 days');

alter table public.conversation_sessions
  add column if not exists purge_after timestamptz,
  add column if not exists retention_hold boolean not null default false;

update public.conversation_sessions
set purge_after = started_at + interval '365 days'
where external_call_id is not null and purge_after is null;

alter table public.conversation_messages
  add column if not exists purge_after timestamptz,
  add column if not exists retention_hold boolean not null default false;

update public.conversation_messages
set purge_after = created_at + interval '365 days'
where source like 'twilio%' and purge_after is null;

alter table public.voice_email_outbox
  add column if not exists purge_after timestamptz,
  add column if not exists dead_letter_after timestamptz,
  add column if not exists retention_hold boolean not null default false,
  add column if not exists alert_24h_at timestamptz,
  add column if not exists alert_7d_at timestamptz,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists scrubbed_at timestamptz;

alter table public.voice_email_outbox
  alter column text_body drop not null;

update public.voice_email_outbox
set
  purge_after = coalesce(purge_after, coalesce(sent_at, created_at) + interval '30 days'),
  dead_letter_after = coalesce(dead_letter_after, created_at + interval '90 days')
where purge_after is null or dead_letter_after is null;

alter table public.voice_email_outbox
  drop constraint if exists voice_email_outbox_event_type_check,
  drop constraint if exists voice_email_outbox_status_check;

alter table public.voice_email_outbox
  add constraint voice_email_outbox_event_type_check
    check (event_type in ('voice_lead', 'voicemail', 'voice_ops_alert')),
  add constraint voice_email_outbox_status_check
    check (status in ('pending', 'sending', 'sent', 'failed', 'dead_letter'));

create or replace function public.set_voice_retention_deadlines()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'voice_call_context' then
    new.purge_after := coalesce(new.purge_after, new.created_at + interval '30 days');
    new.delete_after := coalesce(new.delete_after, new.created_at + interval '365 days');
  elsif tg_table_name = 'conversation_sessions' then
    if new.external_call_id is not null then
      new.purge_after := coalesce(new.purge_after, new.started_at + interval '365 days');
    end if;
  elsif tg_table_name = 'conversation_messages' then
    if new.source like 'twilio%' then
      new.purge_after := coalesce(new.purge_after, new.created_at + interval '365 days');
    end if;
  elsif tg_table_name = 'voice_email_outbox' then
    new.dead_letter_after := coalesce(new.dead_letter_after, new.created_at + interval '90 days');
    if new.status = 'sent' then
      new.purge_after := coalesce(new.sent_at, new.updated_at, now()) + interval '30 days';
    else
      new.purge_after := coalesce(new.purge_after, new.created_at + interval '30 days');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voice_call_context_retention_deadlines on public.voice_call_context;
create trigger trg_voice_call_context_retention_deadlines
before insert or update on public.voice_call_context
for each row execute function public.set_voice_retention_deadlines();

drop trigger if exists trg_conversation_sessions_retention_deadlines on public.conversation_sessions;
create trigger trg_conversation_sessions_retention_deadlines
before insert or update on public.conversation_sessions
for each row execute function public.set_voice_retention_deadlines();

drop trigger if exists trg_conversation_messages_retention_deadlines on public.conversation_messages;
create trigger trg_conversation_messages_retention_deadlines
before insert or update on public.conversation_messages
for each row execute function public.set_voice_retention_deadlines();

drop trigger if exists trg_voice_email_outbox_retention_deadlines on public.voice_email_outbox;
create trigger trg_voice_email_outbox_retention_deadlines
before insert or update on public.voice_email_outbox
for each row execute function public.set_voice_retention_deadlines();

create index if not exists idx_voice_call_context_recording_purge_due
  on public.voice_call_context (purge_after, recording_purge_next_attempt_at)
  where recording_sid is not null and retention_hold = false;

create index if not exists idx_voice_call_context_delete_due
  on public.voice_call_context (delete_after)
  where recording_sid is null and retention_hold = false;

create index if not exists idx_voice_sessions_purge_due
  on public.conversation_sessions (purge_after)
  where external_call_id is not null and retention_hold = false;

create index if not exists idx_voice_messages_purge_due
  on public.conversation_messages (purge_after)
  where source like 'twilio%' and retention_hold = false;

create index if not exists idx_voice_email_outbox_sent_scrub_due
  on public.voice_email_outbox (purge_after)
  where status = 'sent' and scrubbed_at is null and retention_hold = false;

create index if not exists idx_voice_email_outbox_dead_letter_due
  on public.voice_email_outbox (dead_letter_after)
  where status in ('pending', 'failed', 'sending') and retention_hold = false;

create index if not exists idx_voice_email_outbox_alert_24h_due
  on public.voice_email_outbox (created_at)
  where status in ('pending', 'failed') and alert_24h_at is null and retention_hold = false;

create index if not exists idx_voice_email_outbox_alert_7d_due
  on public.voice_email_outbox (created_at)
  where status in ('pending', 'failed') and alert_7d_at is null and retention_hold = false;

-- Claim rows with SKIP LOCKED so overlapping workers cannot own the same
-- provider recording. Callers pass one cryptographically random batch token.
create or replace function public.claim_voice_recordings_for_purge(
  p_lease_token uuid,
  p_limit integer default 10,
  p_now timestamptz default now()
)
returns table(call_sid text, recording_sid text)
language sql
security definer
set search_path = pg_catalog
as $$
  with candidates as (
    select context.call_sid
    from public.voice_call_context as context
    where context.retention_hold = false
      and context.recording_sid is not null
      and context.purge_after <= p_now
      and (context.recording_purge_next_attempt_at is null or context.recording_purge_next_attempt_at <= p_now)
      and (
        context.recording_purge_lease_token is null
        or context.recording_purge_lease_expires_at is null
        or context.recording_purge_lease_expires_at <= p_now
      )
    order by context.purge_after asc
    for update skip locked
    limit least(greatest(p_limit, 1), 25)
  )
  update public.voice_call_context as context
  set
    recording_purge_lease_token = p_lease_token,
    recording_purge_lease_expires_at = p_now + interval '10 minutes',
    recording_purge_attempt_count = context.recording_purge_attempt_count + 1,
    recording_purge_last_error = null,
    updated_at = p_now
  from candidates
  where context.call_sid = candidates.call_sid
  returning context.call_sid, context.recording_sid;
$$;

create or replace function public.complete_voice_recording_purge(
  p_call_sid text,
  p_recording_sid text,
  p_lease_token uuid,
  p_purged_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  affected integer;
begin
  update public.voice_call_context
  set
    recording_sid = null,
    recording_status = 'deleted',
    recording_duration = null,
    recording_purged_at = p_purged_at,
    recording_purge_lease_token = null,
    recording_purge_lease_expires_at = null,
    recording_purge_next_attempt_at = null,
    recording_purge_last_error = null,
    updated_at = p_purged_at
  where call_sid = p_call_sid
    and recording_sid = p_recording_sid
    and recording_purge_lease_token = p_lease_token
    and retention_hold = false;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.fail_voice_recording_purge(
  p_call_sid text,
  p_recording_sid text,
  p_lease_token uuid,
  p_error_code text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  affected integer;
begin
  update public.voice_call_context
  set
    recording_purge_lease_token = null,
    recording_purge_lease_expires_at = null,
    recording_purge_next_attempt_at = p_now + interval '1 day',
    recording_purge_last_error = left(regexp_replace(coalesce(p_error_code, 'provider_delete_failed'), '[^a-zA-Z0-9_:-]', '', 'g'), 80),
    updated_at = p_now
  where call_sid = p_call_sid
    and recording_sid = p_recording_sid
    and recording_purge_lease_token = p_lease_token
    and retention_hold = false;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

-- Non-mutating, aggregate-only preview for authenticated dry runs. No caller,
-- transcript, phone, message, or provider identifier is returned.
create or replace function public.preview_voice_data_retention(
  p_now timestamptz default now()
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'recordings_due', (
      select count(*) from public.voice_call_context
      where retention_hold = false and recording_sid is not null and purge_after <= p_now
    ),
    'caller_contexts_due', (
      select count(*) from public.voice_call_context
      where retention_hold = false and recording_sid is null and delete_after <= p_now
    ),
    'voice_messages_due', (
      select count(*) from public.conversation_messages as message
      join public.conversation_sessions as session on session.session_id = message.session_id
      where message.retention_hold = false and session.retention_hold = false
        and session.external_call_id is not null and message.purge_after <= p_now
    ),
    'voice_sessions_due', (
      select count(*) from public.conversation_sessions as session
      where session.retention_hold = false and session.external_call_id is not null
        and session.purge_after <= p_now
    ),
    'sent_outbox_scrub_due', (
      select count(*) from public.voice_email_outbox
      where retention_hold = false and status = 'sent' and scrubbed_at is null and purge_after <= p_now
    ),
    'outbox_alert_24h_due', (
      select count(*) from public.voice_email_outbox
      where retention_hold = false and event_type in ('voice_lead', 'voicemail')
        and status in ('pending', 'failed') and alert_24h_at is null
        and created_at <= p_now - interval '24 hours' and created_at > p_now - interval '7 days'
    ),
    'outbox_alert_7d_due', (
      select count(*) from public.voice_email_outbox
      where retention_hold = false and event_type in ('voice_lead', 'voicemail')
        and status in ('pending', 'failed') and alert_7d_at is null
        and created_at <= p_now - interval '7 days'
    ),
    'outbox_dead_letter_due', (
      select count(*) from public.voice_email_outbox
      where retention_hold = false and status in ('pending', 'failed', 'sending')
        and dead_letter_after <= p_now
        and (
          status <> 'sending'
          or lease_expires_at is null
          or lease_expires_at <= p_now
        )
    )
  );
$$;

-- One service-role operation places or releases a legal/operational hold on
-- all Supabase voice rows associated with a Twilio Call SID.
create or replace function public.set_voice_retention_hold(
  p_external_call_id text,
  p_hold boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  contexts_changed integer := 0;
  sessions_changed integer := 0;
  messages_changed integer := 0;
  outbox_rows_changed integer := 0;
begin
  if p_external_call_id is null or p_external_call_id !~ '^CA[0-9a-fA-F]{32}$' then
    raise exception 'invalid_external_call_id';
  end if;

  update public.voice_call_context
  set retention_hold = p_hold, updated_at = now()
  where call_sid = p_external_call_id and retention_hold is distinct from p_hold;
  get diagnostics contexts_changed = row_count;

  update public.conversation_sessions
  set retention_hold = p_hold
  where external_call_id = p_external_call_id and retention_hold is distinct from p_hold;
  get diagnostics sessions_changed = row_count;

  update public.conversation_messages as message
  set retention_hold = p_hold
  where message.session_id in (
    select session.session_id
    from public.conversation_sessions as session
    where session.external_call_id = p_external_call_id
  ) and message.retention_hold is distinct from p_hold;
  get diagnostics messages_changed = row_count;

  update public.voice_email_outbox
  set retention_hold = p_hold, updated_at = now()
  where external_call_id = p_external_call_id and retention_hold is distinct from p_hold;
  get diagnostics outbox_rows_changed = row_count;

  return jsonb_build_object(
    'caller_contexts_changed', contexts_changed,
    'sessions_changed', sessions_changed,
    'messages_changed', messages_changed,
    'outbox_rows_changed', outbox_rows_changed
  );
end;
$$;

-- Database-only cleanup runs after provider audio deletion. Each operation is
-- independently bounded. Voice message rows are removed before their sessions;
-- caller context is removed only after the recording reference has been cleared
-- following a verified Twilio 204/404 response.
create or replace function public.run_voice_data_retention(
  p_limit integer default 25,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  batch_limit integer := least(greatest(p_limit, 1), 100);
  messages_deleted integer := 0;
  sessions_deleted integer := 0;
  contexts_deleted integer := 0;
  sent_scrubbed integer := 0;
  dead_lettered integer := 0;
  alerts_24h integer := 0;
  alerts_7d integer := 0;
begin
  with candidates as (
    select id
    from public.voice_email_outbox
    where retention_hold = false
      and event_type in ('voice_lead', 'voicemail')
      and status in ('pending', 'failed')
      and alert_24h_at is null
      and created_at <= p_now - interval '24 hours'
      and created_at > p_now - interval '7 days'
    order by created_at asc
    for update skip locked
    limit batch_limit
  )
  update public.voice_email_outbox as outbox
  set alert_24h_at = p_now, updated_at = p_now
  from candidates
  where outbox.id = candidates.id;
  get diagnostics alerts_24h = row_count;

  if alerts_24h > 0 then
    insert into public.voice_email_outbox (
      idempotency_key, event_type, recipient, subject, text_body, html_body, payload,
      status, created_at, updated_at
    ) values (
      'voice-ops-alert:24h:' || to_char(p_now at time zone 'UTC', 'YYYY-MM-DD'),
      'voice_ops_alert', null, 'WildWorks voice email delivery warning',
      alerts_24h || ' voice notification(s) have remained unsent for at least 24 hours. Check the server-only outbox.',
      null, '{}'::jsonb, 'pending', p_now, p_now
    ) on conflict (idempotency_key) do nothing;
  end if;

  with candidates as (
    select id
    from public.voice_email_outbox
    where retention_hold = false
      and event_type in ('voice_lead', 'voicemail')
      and status in ('pending', 'failed')
      and alert_7d_at is null
      and created_at <= p_now - interval '7 days'
    order by created_at asc
    for update skip locked
    limit batch_limit
  )
  update public.voice_email_outbox as outbox
  set alert_7d_at = p_now, updated_at = p_now
  from candidates
  where outbox.id = candidates.id;
  get diagnostics alerts_7d = row_count;

  if alerts_7d > 0 then
    insert into public.voice_email_outbox (
      idempotency_key, event_type, recipient, subject, text_body, html_body, payload,
      status, created_at, updated_at
    ) values (
      'voice-ops-alert:7d:' || to_char(p_now at time zone 'UTC', 'YYYY-MM-DD'),
      'voice_ops_alert', null, 'WildWorks voice email delivery failure',
      alerts_7d || ' voice notification(s) have remained unsent for at least 7 days. Immediate server-side review is required.',
      null, '{}'::jsonb, 'pending', p_now, p_now
    ) on conflict (idempotency_key) do nothing;
  end if;

  with candidates as (
    select id
    from public.voice_email_outbox
    where retention_hold = false and status = 'sent'
      and scrubbed_at is null and purge_after <= p_now
    order by purge_after asc
    for update skip locked
    limit batch_limit
  )
  update public.voice_email_outbox as outbox
  set
    recipient = null,
    text_body = null,
    html_body = null,
    payload = '{}'::jsonb,
    last_error = null,
    scrubbed_at = p_now,
    lease_token = null,
    lease_expires_at = null,
    updated_at = p_now
  from candidates
  where outbox.id = candidates.id;
  get diagnostics sent_scrubbed = row_count;

  with candidates as (
    select id
    from public.voice_email_outbox
    where retention_hold = false and status in ('pending', 'failed', 'sending')
      and dead_letter_after <= p_now
      and (
        status <> 'sending'
        or lease_expires_at is null
        or lease_expires_at <= p_now
      )
    order by dead_letter_after asc
    for update skip locked
    limit batch_limit
  )
  update public.voice_email_outbox as outbox
  set
    status = 'dead_letter',
    recipient = null,
    subject = '[scrubbed]',
    text_body = null,
    html_body = null,
    payload = '{}'::jsonb,
    last_error = null,
    dead_lettered_at = p_now,
    scrubbed_at = p_now,
    lease_token = null,
    lease_expires_at = null,
    next_attempt_at = null,
    updated_at = p_now
  from candidates
  where outbox.id = candidates.id;
  get diagnostics dead_lettered = row_count;

  with candidates as (
    select message.id
    from public.conversation_messages as message
    join public.conversation_sessions as session on session.session_id = message.session_id
    where message.retention_hold = false and session.retention_hold = false
      and session.external_call_id is not null
      and message.purge_after <= p_now
    order by message.purge_after asc
    for update of message skip locked
    limit batch_limit
  )
  delete from public.conversation_messages as message
  using candidates
  where message.id = candidates.id;
  get diagnostics messages_deleted = row_count;

  with candidates as (
    select session.session_id
    from public.conversation_sessions as session
    where session.retention_hold = false
      and session.external_call_id is not null
      and session.purge_after <= p_now
      and not exists (
        select 1 from public.conversation_messages as message
        where message.session_id = session.session_id
      )
    order by session.purge_after asc
    for update skip locked
    limit batch_limit
  )
  delete from public.conversation_sessions as session
  using candidates
  where session.session_id = candidates.session_id;
  get diagnostics sessions_deleted = row_count;

  with candidates as (
    select call_sid
    from public.voice_call_context
    where retention_hold = false
      and recording_sid is null
      and delete_after <= p_now
    order by delete_after asc
    for update skip locked
    limit batch_limit
  )
  delete from public.voice_call_context as context
  using candidates
  where context.call_sid = candidates.call_sid;
  get diagnostics contexts_deleted = row_count;

  return jsonb_build_object(
    'messages_deleted', messages_deleted,
    'sessions_deleted', sessions_deleted,
    'caller_contexts_deleted', contexts_deleted,
    'sent_outbox_scrubbed', sent_scrubbed,
    'outbox_dead_lettered', dead_lettered,
    'outbox_alerts_24h_marked', alerts_24h,
    'outbox_alerts_7d_marked', alerts_7d
  );
end;
$$;

revoke all on function public.set_voice_retention_deadlines() from public, anon, authenticated;
revoke all on function public.claim_voice_recordings_for_purge(uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_voice_recording_purge(text, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_voice_recording_purge(text, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.preview_voice_data_retention(timestamptz) from public, anon, authenticated;
revoke all on function public.set_voice_retention_hold(text, boolean) from public, anon, authenticated;
revoke all on function public.run_voice_data_retention(integer, timestamptz) from public, anon, authenticated;

grant execute on function public.claim_voice_recordings_for_purge(uuid, integer, timestamptz) to service_role;
grant execute on function public.complete_voice_recording_purge(text, text, uuid, timestamptz) to service_role;
grant execute on function public.fail_voice_recording_purge(text, text, uuid, text, timestamptz) to service_role;
grant execute on function public.preview_voice_data_retention(timestamptz) to service_role;
grant execute on function public.set_voice_retention_hold(text, boolean) to service_role;
grant execute on function public.run_voice_data_retention(integer, timestamptz) to service_role;

comment on column public.voice_call_context.retention_hold is
  'When true, automated audio and caller-context retention is suspended for this row.';
comment on column public.conversation_sessions.retention_hold is
  'When true, automated deletion of this voice session and its messages is suspended.';
comment on column public.voice_email_outbox.dead_lettered_at is
  'Timestamp when an undelivered notification was permanently stopped and its content scrubbed.';

commit;
