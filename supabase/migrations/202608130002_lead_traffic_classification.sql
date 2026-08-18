-- Carry server-owned traffic classification onto leads so owner/test leads
-- cannot inflate public conversion counts or Codex alerts.

alter table public.iscott_leads
  add column if not exists traffic_class text not null default 'public',
  add column if not exists traffic_reason text not null default 'unclassified_legacy',
  add column if not exists traffic_confidence numeric not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'iscott_leads_traffic_class_check') then
    alter table public.iscott_leads
      add constraint iscott_leads_traffic_class_check
      check (traffic_class in ('owner', 'test', 'public', 'bot'));
  end if;
end $$;

update public.iscott_leads as lead
set traffic_class = device.traffic_class,
    traffic_reason = device.traffic_reason,
    traffic_confidence = device.traffic_confidence
from public.visitor_devices as device
where device.anonymous_visitor_id = lead.anonymous_visitor_id;

create index if not exists idx_iscott_leads_traffic_submitted
  on public.iscott_leads (traffic_class, submitted_at desc);
