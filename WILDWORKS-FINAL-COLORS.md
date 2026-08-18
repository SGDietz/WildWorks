# WildWorks — FINAL COLORS (locked 2026-08-18 by G)

G: "this is the final colors. No drift."

| Role                  | Token           | Hex       |
|-----------------------|-----------------|-----------|
| Primary background    | `--ww-primary`  | `#c44d0b` |
| Secondary / card      | `--ww-card`     | `#e96819` |
| Text 1                | `--ww-text-1`   | `#fce0ad` |
| Text 2                | `--ww-text-2`   | `#edc775` |
| Text 3                | `--ww-text-3`   | `#f08c28` |

Source of truth: `app/H221-sitewide-five-color-authority.css`.

## Centre glow (do not flatten)
The page canvas is NOT one flat colour. It carries a symmetric centre lift that
G considers essential. Edges sit on the primary and rise toward the middle:

    edges          #c44d0b
    16% and 84%    #cf530e
    28% and 72%    #d95810
    38% and 62%    #de5c12
    44%-56%        #e15d12

Defined as `--ww-canonical-home-glow` in `app/H231-home-glow-canvas-lock.css`.
Measured live: luminance 97.5 at both edges rising to 115.6 at centre.

## How drift is prevented
1. `scripts/check-wildworks-palette-authority.mjs` asserts each of the five
   appears exactly once in H221, AND fails the build if any of 26 abandoned
   colours reappears anywhere under `app/` - including inside comments.
2. `scripts/check-wildworks-background-lock.mjs` pins the canvas and themeColor.
3. Both run inside `npm run build`, so a drifted colour cannot ship.
4. Verified at runtime across all 12 routes: every page resolves the identical
   five tokens with the glow present.

## If a colour must ever change
Change it in H221 first, then update the canonical map in the palette-authority
script, then move the old value into that script's forbiddenDrift list. Skipping
step three is how the site drifted the first time.
