-- PREPARATION ONLY. This file has not been applied and applying it is a
-- separate, explicitly authorized action. Application source remains
-- hard-disabled regardless: creating these columns cannot start a send.
--
-- What it adds:
--   1. a visitor-confirmation event type for the shared outbox, distinct from
--      the owner notification in every way that matters;
--   2. lead columns that link and status the visitor receipt separately from
--      the owner notification, so neither can be read as the other;
--   3. a non-PII version hash of the submitted package;
--   4. provider acceptance and inbox delivery as two different facts.
--
-- What it deliberately does NOT do: there is no UPDATE, no INSERT, and no
-- backfill anywhere in this file. No historical lead is queued, receipted, or
-- retroactively marked as anything. Existing rows adopt the inert
-- 'approval_required' default, which is a resting state and not a work item -
-- nothing in the application enqueues from a status value.

alter table public.iscott_leads
  add column if not exists visitor_confirmation_recipient text,
  add column if not exists visitor_confirmation_outbox_id uuid
    references public.voice_email_outbox(id) on delete set null,
  add column if not exists visitor_confirmation_idempotency_key text,
  add column if not exists visitor_confirmation_package_version_hash text,
  add column if not exists visitor_confirmation_status text not null default 'approval_required',
  add column if not exists visitor_confirmation_provider_accepted_at timestamptz,
  add column if not exists visitor_confirmation_inbox_delivered_at timestamptz,
  add column if not exists visitor_confirmation_block_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'iscott_leads_visitor_confirmation_status_check'
  ) then
    alter table public.iscott_leads
      add constraint iscott_leads_visitor_confirmation_status_check
      check (visitor_confirmation_status in (
        'approval_required', 'blocked', 'queued', 'provider_accepted', 'failed'
      ));
  end if;

  -- The version hash is a SHA-256 digest and nothing else. A column that will
  -- not accept anything but 64 hex characters cannot quietly start carrying a
  -- name or a mailbox.
  if not exists (
    select 1 from pg_constraint
    where conname = 'iscott_leads_visitor_confirmation_version_hash_check'
  ) then
    alter table public.iscott_leads
      add constraint iscott_leads_visitor_confirmation_version_hash_check
      check (
        visitor_confirmation_package_version_hash is null or
        visitor_confirmation_package_version_hash ~ '^[0-9a-f]{64}$'
      );
  end if;

  -- PROVIDER ACCEPTED IS NOT INBOX DELIVERED. A 2xx from the mail provider may
  -- set the acceptance column. The delivery column can only be truthfully set
  -- by a separately authorized, authenticated provider webhook, which is not
  -- implemented or enabled anywhere in this change - and it can never precede
  -- an acceptance.
  if not exists (
    select 1 from pg_constraint
    where conname = 'iscott_leads_visitor_confirmation_delivery_truth_check'
  ) then
    alter table public.iscott_leads
      add constraint iscott_leads_visitor_confirmation_delivery_truth_check
      check (
        visitor_confirmation_inbox_delivered_at is null or
        visitor_confirmation_provider_accepted_at is not null
      );
  end if;

  -- Acceptance is a claim about a specific message to a specific address. It
  -- may not exist without the row that carries them.
  if not exists (
    select 1 from pg_constraint
    where conname = 'iscott_leads_visitor_confirmation_accepted_linkage_check'
  ) then
    alter table public.iscott_leads
      add constraint iscott_leads_visitor_confirmation_accepted_linkage_check
      check (
        visitor_confirmation_status <> 'provider_accepted' or (
          visitor_confirmation_outbox_id is not null and
          visitor_confirmation_recipient is not null and
          visitor_confirmation_provider_accepted_at is not null
        )
      );
  end if;
end $$;

-- One receipt per submitted package version. Two processes racing the same
-- submission collide here rather than mailing the visitor twice.
create unique index if not exists uq_iscott_leads_visitor_confirmation_idempotency
  on public.iscott_leads (visitor_confirmation_idempotency_key)
  where visitor_confirmation_idempotency_key is not null;

alter table public.voice_email_outbox
  drop constraint if exists voice_email_outbox_event_type_check;

alter table public.voice_email_outbox
  add constraint voice_email_outbox_event_type_check
    check (event_type in (
      'voice_lead', 'voicemail', 'voice_ops_alert', 'iscott_lead',
      'iscott_visitor_confirmation', 'telemetry_message', 'telemetry_digest'
    ));

comment on column public.iscott_leads.visitor_confirmation_recipient is
  'Visitor recipient, snapshotted separately from the global owner-notification recipient. Never the owner address.';

comment on column public.iscott_leads.visitor_confirmation_package_version_hash is
  'SHA-256 of the canonical submitted package. Contains no personal data; a changed package yields a different hash and a different receipt identity.';

comment on column public.iscott_leads.visitor_confirmation_status is
  'Defaults to approval_required: automated visitor dispatch stays off until the owner explicitly authorizes it. provider_accepted means provider API acceptance, not inbox delivery.';

comment on column public.iscott_leads.visitor_confirmation_inbox_delivered_at is
  'Reserved for a separately authorized authenticated provider webhook. No application code in this change writes this column.';
