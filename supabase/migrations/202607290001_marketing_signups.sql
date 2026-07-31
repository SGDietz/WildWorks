-- WildWorks email/SMS signup ledger. Server-only routes write through the service role.

create table if not exists public.marketing_signups (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone_e164 text,
  email_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  source_path text not null default '/',
  email_delivery_status text not null default 'not_requested'
    check (email_delivery_status in ('not_requested', 'pending', 'sent', 'failed')),
  sms_delivery_status text not null default 'not_requested'
    check (sms_delivery_status in ('not_requested', 'pending', 'sent', 'failed')),
  provider_message_ids jsonb not null default '{}'::jsonb,
  delivery_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (email_opt_in and email is not null and email <> '')
    or (sms_opt_in and phone_e164 is not null and phone_e164 <> '')
  )
);

create index if not exists idx_marketing_signups_created_at
  on public.marketing_signups (created_at desc);
create index if not exists idx_marketing_signups_email
  on public.marketing_signups (email)
  where email is not null;
create index if not exists idx_marketing_signups_phone_e164
  on public.marketing_signups (phone_e164)
  where phone_e164 is not null;

alter table public.marketing_signups enable row level security;
