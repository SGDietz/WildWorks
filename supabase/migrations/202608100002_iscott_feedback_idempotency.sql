-- Make transcript-derived iScott lead, feedback, and preference rows retry-safe.

alter table public.transcript_events
  add column if not exists source_event_key text;

alter table public.feedback_events
  add column if not exists source_event_key text;

alter table public.preference_candidates
  add column if not exists source_event_key text;

create unique index if not exists uq_transcript_events_source_event_key
  on public.transcript_events (source_event_key);

create unique index if not exists uq_feedback_events_source_event_key
  on public.feedback_events (source_event_key);

create unique index if not exists uq_preference_candidates_source_event_key
  on public.preference_candidates (source_event_key);
