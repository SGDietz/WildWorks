# Home page shadow + type pass — G's laptop walk-through, 2026-08-19

**Scope G set: HOME PAGE ONLY for now.** "Let's just get it on the home page,
and then we'll get it across everywhere else." The one exception is item 1,
which he explicitly said to fix on five pages.

Laptop = `xl:` (1280–1535). Never target `2xl:` alone — invisible to G.

## Before touching anything
- `H289-iscott-front-door-ideal-shadow.css`, `H290-project-wildfire-ideal-shadow.css`
  and `logo-menu-shadow-tune.css` are **imported nowhere** (verified 2026-08-19).
  The first two are named for these exact shadows. Read them before hand-tuning.
- Take a computed-style baseline and diff after — never regress approved work.
- A rule that exists can still lose. Check it WINS (`!important` beats specificity).
- Shadows in px go 1.5–3.3x heavy on mobile; convert to em.

## The list

| # | Target | Change |
|---|--------|--------|
| 1 | "Fine Art" and "Practical Landscaping" title lines | **Tighten the shadow.** Background shows through the gap between the descender of the **g** and its shadow. "Nowhere should be like that." Also fix on **Wildfire, Ruins, Projects, Bio** — five pages total. |
| 2 | "WildWorks Concierge" (the one at the TOP) | **+20% shadow** |
| 3 | Items 1/2/3/4, "describe areas you'd like beautified or problem areas you may have" | **−20% shadow** (only the 1–4 block) |
| 4 | Text under the avatar: "by talking to iScott or uploading media" | **−20% shadow** |
| 5 | The block continuing after #4 ("then we just kept going") | **−20% shadow** — *confirm which block G meant* |
| 6 | WildWorks scrolls, mid-page: "the limits of human imagination", "of contractor" | Shadow sits **too far off** — tighten the offset |
| 7 | Small text under "Tree of Life natural stone patio"; "all stem work … by WildWorks" | **+20% shadow** on both |
| 8 | "…a ruin of your own?" → "of your own"; "The Ruins" big text on the ruins card | **−10% shadow** on both |
| 9 | "WildWorks Projects / Wild by Design" heading | **−10% shadow** |
| 10 | All the text under #9 | **One font size larger** + **colour #2** (`--ww-text-2 #edc775`) |
| 11 | "What WildWorks is Known For" | **−10% shadow** ("services is fine") |
| 12 | The six cards (designing, problem solving, …) | **All text → colour #2** |
| 13 | "Let's talk about your dream project" card → **Talk to iScott** button | "Looks like shit, dingy." **Call Now / Email Now are perfect — match them exactly.** Screenshot both and compare. |
| 14 | Avatar block at the BOTTOM | Make it **the same as the avatar block at the top** |
| 15 | "Call WildWorks Today!" + the phone number at the bottom | **+20% shadow** |

## Open question for G
- #5: which block is "then we just kept going"?

## Method G asked for
"I think you're gonna have to create screenshots and then just look at it. Just
match them up." — headless screenshot every change and LOOK before calling it
done. Never tap/start the avatar.
