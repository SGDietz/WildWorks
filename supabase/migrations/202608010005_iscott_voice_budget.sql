-- Atomic, service-role-only daily usage reservations for the iScott phone agent.
-- Keeping these counters in a private schema prevents browser clients from
-- reading or changing the production AI budget.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.iscott_voice_daily_usage (
  usage_day date not null,
  metric text not null check (metric in ('calls', 'prompts', 'output_chars')),
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (usage_day, metric)
);

alter table private.iscott_voice_daily_usage enable row level security;
revoke all on table private.iscott_voice_daily_usage from public, anon, authenticated;

create or replace function public.reserve_iscott_voice_daily_usage(
  p_metric text,
  p_requested integer,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_used bigint;
  v_granted integer;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service role required';
  end if;
  if p_metric not in ('calls', 'prompts', 'output_chars') then
    raise exception 'invalid metric' using errcode = '22023';
  end if;
  if p_requested < 0 or p_limit < 1 or p_limit > 100000000 then
    raise exception 'invalid budget reservation' using errcode = '22023';
  end if;

  insert into private.iscott_voice_daily_usage (usage_day, metric)
  values (v_day, p_metric)
  on conflict (usage_day, metric) do nothing;

  select used
    into v_used
    from private.iscott_voice_daily_usage
   where usage_day = v_day and metric = p_metric
   for update;

  v_granted := least(p_requested, greatest(0, p_limit - v_used)::integer);
  if v_granted > 0 then
    update private.iscott_voice_daily_usage
       set used = used + v_granted,
           updated_at = timezone('utc', now())
     where usage_day = v_day and metric = p_metric;
  end if;
  return v_granted;
end;
$$;

revoke all on function public.reserve_iscott_voice_daily_usage(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_iscott_voice_daily_usage(text, integer, integer)
  to service_role;
