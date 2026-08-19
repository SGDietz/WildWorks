# Chief current smoke evidence — 2026-08-17

Current task only: verify G's latest iScott smoke test and the newest rendered build.

- The latest production build completed at 3:36 PM and the port 3020 server restarted immediately afterward.
- The exact existing Comet/Tailnet WildWorks tab was hard-refreshed after that restart; it is now displaying the newest build.
- The Home document returns `Cache-Control: no-cache`; this is no longer an old-browser-copy explanation.
- Read-only Supabase telemetry for the current window shows conversation traffic arriving.
- No submitted iScott lead was recorded for the smoke-test window.
- No failed notification record was recorded either.

Conclusion: the conversation transcript path is reaching Supabase, but the contact/confirmation handoff did not reach a submitted lead or notification outcome. Do not call this end-to-end live yet. Trace the latest session from transcript sync into lead state, consent/confirmation detection, `/api/iscott/lead/confirm`, and the outbox result. Keep capture, submitted, and delivered states separate.

No Git, push, deploy, provider, or account action is authorized.
