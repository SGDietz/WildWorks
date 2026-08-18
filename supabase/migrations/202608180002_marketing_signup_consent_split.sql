-- T02 rev 2: split marketing consent from non-marketing (service) consent on the
-- WildWorks signup ledger, and let a truthful no-consent row exist.
--
-- Intended repo path: supabase/migrations/202608180002_marketing_signup_consent_split.sql
--
-- WHY THE CONSTRAINT HAS TO CHANGE (installer review, and it was right):
-- Twilio requires consent to be optional. With no box ticked the route must now
-- write email_opt_in = false and sms_opt_in = false, because the visitor has not
-- opted in to anything - writing the channel button into those columns would put
-- a false opt-in in the ledger, which is exactly the record Twilio audits. But
-- the original table CHECK
--
--   CHECK ((email_opt_in AND email IS NOT NULL AND email <> '')
--       OR (sms_opt_in AND phone_e164 IS NOT NULL AND phone_e164 <> ''))
--
-- only passes when at least one opt-in is TRUE, so a truthful no-consent row
-- would be rejected. The constraint is replaced with one that enforces the same
-- real invariant without demanding a lie:
--
--   * the row carries at least one contact value the visitor actually typed, and
--   * any opt-in that IS true has the matching contact value behind it.
--
-- Existing rows all satisfied the old rule with a true opt-in plus its contact
-- value, so they satisfy the new rule too. Pre-flight if you want certainty -
-- this selects, changes nothing, and must return 0:
--
--   select count(*) from public.marketing_signups
--    where not (
--      ((email is not null and email <> '') or (phone_e164 is not null and phone_e164 <> ''))
--      and (not email_opt_in or (email is not null and email <> ''))
--      and (not sms_opt_in or (phone_e164 is not null and phone_e164 <> ''))
--    );
--
-- A second pre-flight, also read-only, for the nullable change - it must return
-- 0 rows that have consent recorded but no timestamp, i.e. nothing is being
-- silently reinterpreted:
--
--   select count(*) from public.marketing_signups where consented_at is null;
--
-- Column adds are additive; no column is dropped or renamed and no existing row
-- is rewritten. Rows written before today keep consent_version '2026-08-01' and
-- land on false/false for the new columns - deliberately, so nobody who signed up
-- under the old combined wording is recorded as having given split consent.
--
-- ROLLBACK: rollback-202608180002.sql.

alter table public.marketing_signups
  add column if not exists marketing_consent boolean not null default false;

alter table public.marketing_signups
  add column if not exists service_consent boolean not null default false;

comment on column public.marketing_signups.marketing_consent is
  'Optional opt-in to marketing messages (design ideas, offers, news). Twilio TFV requires this to be separate from service consent and not required to submit.';

comment on column public.marketing_signups.service_consent is
  'Optional opt-in to non-marketing service messages (project follow-up, scheduling, reminders, service updates).';

-- email_opt_in / sms_opt_in now mean "consented to receive on this channel",
-- never "clicked this button".
comment on column public.marketing_signups.email_opt_in is
  'True only when the visitor gave consent AND chose email. Never derived from the channel button alone.';

comment on column public.marketing_signups.sms_opt_in is
  'True only when the visitor gave consent AND chose SMS. Never derived from the channel button alone.';

-- Rev 3 (installer review): consented_at records WHEN consent was given, so a
-- row with no consent must not carry a timestamp. The column is nullable from
-- here on. The default stays in place for any caller that omits the field; the
-- route passes an explicit null, and an explicit null beats a default.
--
-- No existing row is touched: every historical row keeps the timestamp it has.
alter table public.marketing_signups
  alter column consented_at drop not null;

comment on column public.marketing_signups.consented_at is
  'When consent was given. NULL means no consent was given, which is a valid, saveable state since Twilio requires consent to be optional.';

alter table public.marketing_signups
  drop constraint if exists marketing_signups_check;

alter table public.marketing_signups
  add constraint marketing_signups_contact_and_optin_check check (
    (
      (email is not null and email <> '')
      or (phone_e164 is not null and phone_e164 <> '')
    )
    and (not email_opt_in or (email is not null and email <> ''))
    and (not sms_opt_in or (phone_e164 is not null and phone_e164 <> ''))
  );

create index if not exists idx_marketing_signups_marketing_consent
  on public.marketing_signups (marketing_consent)
  where marketing_consent;

