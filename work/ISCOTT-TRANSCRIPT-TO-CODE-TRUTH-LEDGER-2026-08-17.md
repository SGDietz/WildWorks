# Complete iScott Transcript-to-Code Truth Ledger

**Evidence and boundary.** Read-only reconciliation of the 76-turn Supabase-derived public-session replay fixture, `tests/fixtures/iscott-76-row-replay.json` (`iscott-latest-hard-audit-20260817.json` / `HG-ISCOTT-120-20260816-202557`), current dirty protected WildWorks source, the Herm 120-item matrix, and independent Grok review. Contact values are not reproduced. This is not browser, device, provider, send, migration, or production proof.

**Status vocabulary.** `fixed` needs source plus appropriate acceptance evidence. `prepared but unrendered` has a source path only. `attempted but wrong` conflicts with the stated criterion. `untouched` has no demonstrated source path. `needs live provider/device proof` cannot be settled from source. `needs product decision` changes claim/scope or needs a defined contract.

| # | Distinct request, flaw, or acceptance criterion | Redacted transcript evidence | Current status | Source anchor / why | Next action |
|---:|---|---|---|---|---|
| 1 | State the company-branding and AI-driven website offer accurately. | T2-5: user corrects offer. | prepared but unrendered | 26-21 adds the approved bounded offer to WildWorks `identityBoundaryContext()`; no provider-context mutation occurred. | Verify the stored provider context/session separately. |
| 2 | Answer why a visitor should choose Scott. | T15. | prepared but unrendered | 26-21 adds the approved bounded `why_scott` answer to the local context path only. | Verify the stored provider context/session separately. |
| 3 | Answer whether Scott has done relevant work before this site. | T15. | prepared but unrendered | 26-21 adds truthful prior-work wording: this WildWorks site is his; do not invent client lists. | Verify the stored provider context/session separately. |
| 4 | Make the phone avatar bigger. | T6-7. | prepared but unrendered | Slice 26-2 scopes the full-bleed avatar shell to ≤520px portrait plus bounded landscape-phone; it removes the old 1024px/scale authority. | Device measure remains required. |
| 5 | Hide “WildWorks Concierge” while talking on a phone. | T9. | prepared but unrendered | Phone iScott source now suppresses the avatar heading and `Hi Scott` label at ≤520px portrait plus bounded landscape-phone. | Verify actual talking-state text on phone. |
| 6 | Start the talking-state lockup with “Hi Scott.” | T9; distinct positive copy instruction. | untouched | Fixture opening is “Hi, I’m iScott”; source only hides Concierge, no requested replacement opening. | Provider opening-text update with separate authority; live check. |
| 7 | Let the avatar occupy almost all phone height. | T11-12. | prepared but unrendered | Slice 26-2 retains `100dvh - legal reserve` full-bleed media only for phone scope, with media at z-index 1. | Device geometry measure remains required. |
| 8 | Reserve a small safe legal area underneath. | T10-12. | prepared but unrendered | 26-14 makes the complete existing Home agreement the single phone legal presentation below the avatar on orange; the compact in-avatar legal band is suppressed. | Prove readable, unclipped agreement at 287×511 and normal phone. |
| 9 | Keep all other phone chrome out of streamlined presentation. | T9-12 together. | prepared but unrendered | 26-14 suppresses the phone brown legal/link row and `Hi Scott`; upload/capture/Finish authorities remain unchanged. | Visual/hit-test matrix must prove the remaining controls are unobscured. |
| 10 | On selecting email, immediately reveal email-entry path before address is spoken. | T19-24: expects instant box/Finish transition. | prepared but unrendered | 26-20 preserves a one-word email/phone choice through the parser/capture loop instead of fragment-holding it; current visual `showLead` still requires a captured value. | Add/test the separate no-value visible collection state without guessing a contact. |
| 11 | Do not leave obsolete/misleading Finish state during email capture. | T21-24. | needs live provider/device proof | Finish hook `route.ts:1137-1141`; no proof at #10 transition. | Define transition behavior and verify exact moment method selected. |
| 12 | Port proven iSolve email-capture interaction, not a superficial card. | T25-27, T30-43: explicit instruction. | prepared but unrendered | 26-24 is traced to latest-green `LiveAvatarSession.tsx:7895-7953`: live bar chrome, typewriter feedback, and immediate empty method-choice field. Rejected 26-19/22/23 remain uninstalled. | Rendered phone/device smoke and capture-state ride remain required. |
| 13 | Port must reveal only after complete captured value; never prefill/guess contact. | #12 port acceptance. | prepared but unrendered | 26-24 keeps the existing no-value editable field and the complete-capture reveal guard; visitor edits cancel reveal and remain authoritative. | Test empty, partial, complete capture paths on a real session. |
| 14 | Visitor correction must not be overwritten by reveal animation. | #12 port acceptance. | prepared but unrendered | Slice 26-1 cancels on `beforeinput`/`input` and re-checks the dirty flag immediately before each write; `scripts/check-iscott-reveal-tick.mjs` covers the race predicate. | Device/provider capture check remains required. |
| 15 | Send must never submit a partially revealed contact. | #12 port safety acceptance. | prepared but unrendered | Slice 26-1 preserves the existing reveal guard and uses captured value unless the visitor edits; focused reveal-tick regression covers email/phone prefix cases. | Device/provider capture check remains required. |
| 16 | Port stays visual/behavioral only; no iSolve runtime, account, provider, or send coupling. | #12 plus project boundary. | prepared but unrendered | 26-24 ports only visible bar/typewriter behavior and adapts phone parity; it excludes latest-green signup/magic-link/pill flows. WildWorks stays on `/api/iscott/lead/confirm` and delivery-gated sent state. | Rendered/state smoke; preserve isolation. |
| 17 | Show captured email visibly once actually captured. | T44-48; value redacted. | prepared but unrendered | `route.ts:1101-1103,1146-1167`; capture `iscottLeadCapture.ts:527-575`. | Live check: captured-only/full/readable, no premature paint. |
| 18 | Have iScott read captured email back. | T44-48. | needs live provider/device proof | Local data path; FULL avatar speech provider-controlled. | Synthetic-contact provider session. |
| 19 | Speak it character-by-character using dashes, “at,” and “dot.” | T50-54. | needs live provider/device proof | Local email helper exists; 26-22 now also projects valid phones as dashed `spokenReadback` without changing their stored/display values. FULL-TTS remains external. | Provider prompt/test with synthetic redacted contact. |
| 20 | Use “Scott,” not “WildWorks team,” for handoff identity. | T56-59. | prepared but unrendered | `saysTeamNotScott`/`allowedIscottSpeech` in `iscottLeadParsing.ts:774-794`; remote mouth external. | Provider/session proof actual wording. |
| 21 | After permission, expose a clear visible action to send details. | T55-64. | prepared but unrendered | Reconciled 26-5b keeps the explicit action transition and `Send` authority; focused transition test distinguishes hidden/pending/queued/failure/sent. | Test post-capture/permission affordance and explicit state. |
| 22 | Remove confusing “confirm before Scott gets them” card wording. | T36-39, T68: user names exact wrong box/copy. | prepared but unrendered | Reconciled 26-5b/26-6 uses approved `I'm sending that to Scott.` action copy and terminal `Email sent to Scott ✓` / phone parity only after real delivery. | Test awaiting/queued/sent rendering. |
| 23 | Never claim preparing, sent, already with Scott, follow-up, or upload completion before verified state. | T55-62. | needs live provider/device proof | Local guards in `iscottLeadCapture.ts:651-659,744+`; provider FULL external. | Non-production state ride; only outbox `sent` supports sent claim. |
| 24 | Provide discoverable usable Finish. | T67-69. | prepared but unrendered | `route.ts:1137-1141` stop hook; source only. | Device-test size/hit target/end result at 412×915 and 287×511. |
| 25 | Confirmation tap must not trap visitor; Hide/Close/Finish must work without closing site. | T68-74. | prepared but unrendered | Slice 26-2 gives Talk/Start z-index 30 above avatar media z-index 1; lead card remains z-index 40. | Live hit-test every action; verify end/no false handoff. |
| 26 | Treat card as unresolved until readable, unobscured, stoppable. | T30-49, T67-74. | needs live provider/device proof | `#wildworks-lead-confirmation` `route.ts:184-201`; media auto-z vs legal band 50. | Measure geometry/computed stacking after real capture. |

## What was missed

**Herm 120 matrix:** #2-3, #6, #10, #21, #22, and port criteria #14-16 were absent or collapsed. It marked mobile rows 59-62 source-covered although the actual 1024px/scale/legal-band rule is not a phone acceptance solution.

**Chief’s first 14-row ledger:** #2, #3, #6, #10, #21, #22 as separate rows. It incorrectly called #10 prepared although `showLead` requires value, merged false-send prohibition with the separate send control, and overstated local email helpers beyond the provider-TTS boundary.

## Implementation order

1. Approve claims/copy (#1-3, #6, #22).
2. Correct phone geometry/stacking and prove it (#4-9, #24-26).
3. Build method-selected/no-value state, then safe isolated capture port (#10-16).
4. Prove capture/read-back/send truth against provider/outbox (#17-23).

No browser, provider, email, migration, commit, push, deploy, or live-data action was performed.

## 2026-08-17 source addendum — transcript storage 26-12

- **Installed and locally checked:** The transcript sync route no longer uses the obsolete `session_id,role,la_absolute_timestamp` conflict target. On a non-duplicate storage failure it records sanitized detail, returns `storeFailed`, preserves the cursor, and still passes the in-memory batch to lead capture. The client surfaces that failure and backs interval sync off from 5 seconds to a 60-second maximum.
- **Not proof yet:** No provider, Supabase, browser, or real smoke rerun occurred. A controlled follow-up ride must show persisted transcript rows, a normal lead state, and no repeated store-failure event before this is treated as fixed in production-like behavior.
