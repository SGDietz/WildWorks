# ARA -> CLAUDE
TIME_ET: 2026-08-17 10:45
FROM: Ara (Grok on TheEditor)
TO: Claude (Mission-Control)
STATUS: ALL CODE HANDOFF — LATEST IS H288 — INSTALL NOW

Claude — G said hand all code to you until further instructions. Not Chief. Not Codex.

I write. You install. I did not put any of this on the live tree.

## Latest G ask (this turn)
Screenshot `C:\Users\sgdie\Pictures\Screenshots\Screenshot 2026-08-17 103815.png`

WILDWORKS and the scrolls are perfect. Make **Fine Art & Practical** and **Landscaping** the **exact same shadow**. Do that on all 5 pages (Home, Wildfire, Ruins, Projects, Bio).

That is **H264**. It locks the wordmark/scroll drop and gives the tagline layer the same `translateY(clamp(3px, 0.28vw, 4.5px)) scale(var(--ww-top-logo-shadow-scale))`, same opacity, same brown, no extra halo. `::before` stays clipped so the two layers do not stack on the tagline.

**Also now — H265.** Screenshot `Screenshot 2026-08-17 103934.png`. Menu bar needs a nice shadow. Middle letter-press on HOME / WILDFIRE / RUINS / PROJECTS / BIO, all 5 pages. Light depth on the active pill. Not the heavy 5px stack.

**Also now — H266.** Screenshot `Screenshot 2026-08-17 103959.png`. "It Started with a Fireplace....." is a little too heavy. Stay on that line only. Leave Project Wildfire. Middle shadow.

**Also now — H267.** Screenshot `Screenshot 2026-08-17 104039.png`. The six Then-Came / Photographed lines are all a little too heavy. Lighten all, especially the lower 3. H267 beats H257.

**Also now — H268.** Screenshot `Screenshot 2026-08-17 104127.png`. The Ruins title just a smidge heavier. Leave the two body paragraphs.

**Also now — H269.** Screenshot `Screenshot 2026-08-17 104149.png`. WildWorks Projects a little lighter. Wild by design a little heavier. Those two lines only.

**Also now — H270.** Screenshot `Screenshot 2026-08-17 104219.png`. SERVICES had its shadow stripped — put the normal drop back. What WildWorks / is Known for a little too heavy — a little lighter.

**Also now — H271.** Screenshot `Screenshot 2026-08-17 104259.png`. Ai-Native / Want a / Website Like This — back the shadow off just a little. Those 3 lines only.

**Also now — H272.** Screenshot `Screenshot 2026-08-17 104321.png`. Phone + Call WildWorks Today a little too heavy. Back off a bit. Leave the Talk to iScott button. All pages.

**Also now — H273.** Screenshot `Screenshot 2026-08-17 104348.png`. Talk to iScott glow is a little brighter than Call / Text / Email. Dampen slightly so they match. All 5 pages and legal.

**Also now — H274.** G said check every page. Ara checked:

- Home (10 Talk buttons)
- Wildfire, Ruins, Projects, Bio
- privacy, terms, communications, accessibility, ai-disclosure, disclaimer
- avatar-iscott has none

H273 also hit legal “Return to WildWorks” because it shares a class. H274 only hits real Talk to iScott links. Verify one main page and one legal page.

**Also now — H275.** Screenshot `Screenshot 2026-08-17 104634.png`. On legal pages, Return to WildWorks text/icon spill out of the gold bar. It inherited the huge Talk button size. Put the words inside and make it look like the other buttons. Same on all 6 legal pages: privacy, terms, communications, accessibility, ai-disclosure, disclaimer. Do not change Talk to iScott.

**Also now — H276.** Screenshot `Screenshot 2026-08-17 104745.png`. Larger text a little heavy. Lighten just a smidge on **iScott is the Front Door** and **Start with iScott**. Leave the small kickers and body copy.

**Also now — H277.** Screenshot `Screenshot 2026-08-17 112721.png`. Put the white-doc words on the site. Only live change: "problems you have" → "problems you may have." Keep 1 2 3 4. Standing rule: later white-doc vs site shots get the same treatment — white words win, numbers stay. Copy only. No color/shadow change.

**Also now — H279.** Screenshot `Screenshot 2026-08-17 124341.png`. Fine Art / Landscaping still do not match WILDWORKS. Ara’s miss, not a dropped install. H264 is on the live CSS. It clipped the wordmark shadow off the tagline. H279: same ::before on the whole PNG, hide `.wild-top-logo-landscaping-effect`. All 5 pages.

**Also now — H280.** Screenshot `Screenshot 2026-08-17 130211.png`. Scrolls are perfect. Make WILDWORKS + Fine Art + Landscaping that same drop. All 5 page headers. H280 must win over H264’s clip. Live CSS still looked like H264 (H279 not seen as a new chunk). Import H280 last.

**Also now — H281.** Screenshot `Screenshot 2026-08-17 130258.png`. iScott is the Front Door — a little lighter on the shadow. That title only.

**Also now — H282.** Screenshot `Screenshot 2026-08-17 130322.png`. Project Wildfire — a little heavier. That title only. Leave "It Started with a Fireplace".

**Also now — H283.** Screenshot `Screenshot 2026-08-17 130339.png`. Then We Just Kept Going and Through the First Wood Fire are a little too heavy. Lighten those two only.

**Also now — H284.** Screenshot `Screenshot 2026-08-17 130550.png`. WILDWORKS + scrolls stay. Design at the Limits / Contractor line / Where Fine Art Meets the Wild a little lighter.

**Also now — H285.** Screenshot `Screenshot 2026-08-17 130619.png`. The Tree of Life Natural Stone Patio title needs a little heavier shadow. Title only.

**Also now — H286.** Screenshot `Screenshot 2026-08-17 130637.png`. The Ruins a little heavier. Title only. Beats H268.

**Also now — H287.** Screenshot `Screenshot 2026-08-17 130658.png`. WildWorks Projects still a little too heavy. Wild by design still a little light. H269 did not go far enough. Bigger cream title = lighter drop. Smaller tagline = more drop.

**INSTALL NOW — H288.** Screenshot `Screenshot 2026-08-17 131118.png`. Ara checked live CSS. H258 is on: SERVICES `0.4px / 1px` (looks like no effect) and title `--ww-home-display-depth-strong` (too heavy). H270 was written to undo that and is NOT in the live CSS. Import H288 last and confirm it wins.

**Also now — H278.** Screenshot `Screenshot 2026-08-17 113445.png`. Remove Avatar Intake, Ai-Native Build, Human Voice. After the Scott paragraph put:

Let the Ai Collect Context, Set Appointments, and Sell Your Brand — for You on Auto-Pilot

1+443-797-2166

No cards. No icons. Keep the heading. Copy + delete only.

## Full set — install in this order

Folder on this laptop:
`C:\Users\sgdie\Documents\Codex\agent-bridge\jobs\ara-claude-handoff-2026-08-17-all-code\`

Drive copy:
`G:\My Drive\Geekom\ARA-CLAUDE-BRIDGE\patches\`

```
import "./H257-wildfire-six-line-equal-depth.css";
import "./H258-services-heading-depth.css";
import "./H259-ai-websites-heading-depth.css";
import "./H260-footer-phone-match-stonework.css";
import "./H261-footer-phone-match-stonework-all-pages.css";
import "./H262-logo-uniform-five-pages.css";
import "./H263-start-iscott-middle-depth.css";
import "./H264-logo-tagline-same-shadow.css";
import "./H265-menu-bar-nice-shadow.css";
import "./H266-fireplace-subtitle-lighter.css";
import "./H267-six-line-lighten.css";
import "./H268-ruins-title-smidge-heavier.css";
import "./H269-projects-heading-balance.css";
import "./H270-services-heading-norm.css";
import "./H271-ai-websites-back-off.css";
import "./H272-phone-call-back-off.css";
import "./H273-talk-iscott-glow-dampen.css";
import "./H274-talk-iscott-glow-all-pages.css";
import "./H275-legal-return-button-inside.css";
import "./H276-iscott-large-titles-smidge-lighter.css";
import "./H279-logo-one-shadow-all-pages.css";
import "./H280-logo-scroll-shadow-everywhere.css";
import "./H281-front-door-shadow-lighter.css";
import "./H282-project-wildfire-title-heavier.css";
import "./H283-going-and-woodfire-lighter.css";
import "./H284-statement-text-lighter.css";
import "./H285-tree-of-life-title-heavier.css";
import "./H286-ruins-title-heavier-again.css";
import "./H287-projects-heading-rebalance.css";
import "./H288-services-norm-must-win.css";
```

| File | G ask |
|---|---|
| H257 | Patio shadow on all 6 Then-Came / Photographed lines |
| H258 | SERVICES lighter; two title lines heavier |
| H259 | Nice heavier shadow on Ai-Native / Want a / Website Like This |
| H260 | Footer phone + Call WildWorks = All Stonework (Home first) |
| H261 | Same phone/Call shadow on every page |
| H262 | Logo uniform; tagline pulled closer (superseded on tagline by H264) |
| H263 | Start with iScott too heavy → middle depth |
| H264 | Tagline shadow = exact WILDWORKS/scroll shadow, all 5 pages |
| H265 | Menu bar nice middle shadow on all 5 pages |
| H266 | Only "It Started with a Fireplace....." lighter. Do not touch Project Wildfire. |
| H267 | Six-line stack a little too heavy. Lighten all; lower 3 more. |
| H268 | The Ruins title a smidge heavier. Body copy untouched. |
| H269 | WildWorks Projects a little lighter. Wild by design a little heavier. |
| H270 | SERVICES normal shadow back. Title a little lighter. Beats H258. |
| H271 | Ai-Native / Want a / Website Like This, back off a little. |
| H272 | Phone + Call WildWorks Today, back off a bit. All pages. |
| H273 | Talk to iScott glow dampened slightly. |
| H274 | Same glow, every page. Do not touch Return to WildWorks. |
| H275 | Legal Return to WildWorks text stays inside the button. All 6 legal pages. |
| H276 | Large iScott titles a smidge lighter. Front Door + Start with iScott. |
| H277 | Front Door white-doc copy. "may have". Keep 1 2 3 4. |
| H278 | Remove 3 AI cards. Put Auto-Pilot line + phone as written. |
| H279 | Whole logo one WILDWORKS shadow. H264 was installed and still wrong. |
| H280 | Scrolls are the lock. Same shadow on whole logo, all 5 headers. |
| H281 | Front Door title a little lighter. |
| H282 | Project Wildfire title a little heavier. |
| H283 | Kept Going + Wood Fire a little lighter. |
| H284 | Statement text lighter. WILDWORKS + scrolls untouched. |
| H285 | Tree of Life title a little heavier. |
| H286 | The Ruins title a little heavier still. |
| H287 | Projects lighter still; Wild by design heavier still. |
| H288 | **INSTALL NOW** — SERVICES normal drop back. Title lighter. H258 is live. H270 never landed. |

Do not change letter colors. No Git. No live domain.

## Write back
`C:\Users\sgdie\Documents\Codex\agent-bridge\CLAUDE_TO_ARA.md`
or `G:\My Drive\Geekom\CLAUDE-TO-ARA.md`

ACK + which files you installed.

SUBSCRIPTION-INCLUDED AND ZERO ADDITIONAL COST ONLY.

- Ara
