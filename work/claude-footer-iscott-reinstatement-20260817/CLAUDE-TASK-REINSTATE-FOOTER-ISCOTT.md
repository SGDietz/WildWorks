# G-authorized Claude task: restore the full footer iScott mock-up

## Authority and role

G approved this implementation with `doit` after Chief described the default below. Claude is the WildWorks code installer. Chief will independently inspect the delta and verify the existing canonical Comet/Tailnet surface afterward.

No Git commit, push, deploy, live-domain change, provider/account change, or paid automated session is authorized.

## Objective

Restore the complete framed iScott presentation that used to appear near the bottom of WildWorks—not merely the current standalone gold `Talk to iScott` button.

The restored presentation must contain:

- `WildWorks Concierge`
- `Start with iScott`
- iScott's resting image
- the gold `Talk to iScott` control over the image
- the existing disclosure treatment
- the existing click-to-wake behavior, without automatically starting a provider session

Reference screenshot showing the current missing state:

`work/claude-footer-iscott-reinstatement-20260817/current-footer-missing-iscott-card.png`

## Exact existing implementation to recover and share

Do not redesign or approximate this card. Reuse the implementation already present on Home:

- `app/pages/Home/page.tsx`
  - `IScottSection` resting-image/live-frame behavior around lines 541-565
  - full `money-panel wild-iscott-panel` presentation around lines 2769-2801
- Resting image: `public/Avatar1-live-startscreen.png`
- Current generic button component: `app/components/LargeIScottCta.tsx`
- Footer insertion/replacement area: `app/components/Footer.tsx`, current closing region around lines 298-365

Prefer extracting/reusing a shared component over copying a second divergent version of the Home implementation. Preserve the established loading, media, disclosure, accessibility, and no-auto-session behavior.

## Approved placement and scope

- Restore the full iScott panel in the footer flow on the five main pages: Home, Wildfire, Ruins, Projects, and Bio.
- Place it after the signup/contact content and before the final closing phone group.
- Replace the lone closing `LargeIScottCta` in that position; do not leave two redundant Talk buttons stacked together.
- Retain the written phone number and `Call WildWorks Today!` line below the restored panel.
- Do not alter the six legal-page `Return to WildWorks` treatment.
- Do not change letter colors, signup behavior, legal copy, contact destinations, or unrelated footer geometry.

## Acceptance requirements

1. Resting page load shows the complete framed iScott mock-up without creating a provider session.
2. The visible Talk control follows the established Home click-to-wake route/behavior.
3. Home, Wildfire, Ruins, Projects, and Bio each show one restored footer panel and one retained closing phone line.
4. All six legal pages retain their existing legal Return control and white-text rules.
5. Desktop, iPad portrait/landscape, and phone layouts have no horizontal overflow, clipping, or duplicated CTA.
6. Run focused type/build guards in proportion to the change.
7. Hand the installed build to Chief for hard-refresh and visual verification in the exact existing Comet/Tailnet tab.

## Report back

State:

- files changed;
- whether you extracted a shared component or reused the current one another way;
- focused checks/build results;
- what remains for Chief's rendered Comet acceptance.
