-- QA lead fixtures sometimes predate anonymous visitor IDs. Their session ID
-- is still an explicit Codex test marker and must not remain public.

update public.iscott_leads
set traffic_class = 'test',
    traffic_reason = 'codex_test_session',
    traffic_confidence = 1
where session_id like 'codex-%';
