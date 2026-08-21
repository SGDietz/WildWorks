-- iscott_error_log was the only table in public with RLS disabled. Supabase
-- grants anon the full set on public tables by default, and RLS is what makes
-- those grants inert. Every other table here already runs RLS on with zero
-- policies, i.e. deny-by-default with the service role bypassing it; this table
-- simply missed that step, so anon could SELECT/INSERT/UPDATE/DELETE/TRUNCATE it
-- with the browser key. It held 0 rows and nothing has ever written to it, so
-- enabling RLS breaks no code path - server writes use the service role, which
-- is not subject to RLS.
-- Found by the 1am scan and fixed on G's go-ahead, 2026-08-18.
alter table public.iscott_error_log enable row level security;
