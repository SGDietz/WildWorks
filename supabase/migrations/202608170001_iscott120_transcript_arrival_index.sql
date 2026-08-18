-- Code-only iScott 120 artifact. Do not apply from Grok.
-- Adds arrival_index so colliding LiveAvatar seconds can persist
-- without inventing a new event time.

alter table public.conversation_messages
  add column if not exists arrival_index integer not null default 0;

comment on column public.conversation_messages.arrival_index is
  'Stable ingest order inside a session. Original la_absolute_timestamp stays the provider event time.';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'conversation_messages_session_id_role_la_absolute_timestamp_key'
  ) then
    alter table public.conversation_messages
      drop constraint conversation_messages_session_id_role_la_absolute_timestamp_key;
  end if;
end $$;

create unique index if not exists uq_conversation_messages_session_role_ts_arrival
  on public.conversation_messages (session_id, role, la_absolute_timestamp, arrival_index);
