import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const treatment = read("app/H337-all-buttons-one-treatment.css");
const interactions = read("app/H106-home-buttons-match-talk-iscott.css");
const anchor = read("app/H153-projects-gallery.css");
const avatar = read("app/pages/avatar-iscott/route.ts");
const home = read("app/pages/Home/page.tsx");
const globals = read("app/globals.css");
const rims = read("app/H482-home-button-dark-rims.css");

const requireText = (source, needle, label) => {
  assert.ok(source.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
};

// One shared Home material and complete rectangular-action inventory.
for (const token of [
  "radial-gradient(circle at 50% -30%",
  "linear-gradient(#fce0ad 0%, #edc775 38%, #f08c28 72%, #c44d0b 100%)",
  "border-color: var(--ww-button-rim-color, #fce0ad)",
  "color: #e96819",
  "--ww-large-cta-shadow",
  "html:has(#top.wild-home)",
  ".money-cta",
  ".wild-iscott-upload__button",
  ".wild-signup-choice-button",
  ".wild-home-phone-iscott-test__button",
  ".wild-footer-top-button",
  ".wild-utility-button",
]) {
  requireText(treatment, token, "shared Home material");
}

// G's accepted dark rim is supplied by the shared variable; pale gold remains
// only its fallback. Do not restore the retired pale border to satisfy this guard.
requireText(rims, "--ww-button-rim-color: #8f3a14", "accepted shared button rim");

// Exactly two intentional label-depth tiers and one icon-depth variable.
requireText(treatment, "--ww-cta-label-shadow:", "normal label tier");
requireText(treatment, "--ww-cta-label-shadow-lg:", "large label tier");
requireText(treatment, "text-shadow: var(--ww-cta-label-shadow,", "normal tier consumer");
requireText(treatment, "text-shadow: var(--ww-cta-label-shadow-lg,", "large tier consumer");
requireText(treatment, "--ww-cta-icon-shadow:", "shared icon depth");
requireText(treatment, "filter: var(--ww-cta-icon-shadow,", "icon depth consumer");
requireText(treatment, "stroke: #e96819", "orange icon ink");
requireText(treatment, "gap: 0.55rem !important", "avatar icon-label gap");
// 2026-09-03: these two needles were written 08-29 for the single-stop icon
// edge. G then approved a different icon shadow and it went sitewide in
// commits d566e06 ("one shadow on the icons, not ten - the ten were the
// 'hideous'") and 7334130 ("the approved icon shadow across the whole site,
// avatar controls included"). The guard kept asserting the retired value and
// has been red since, in a file nobody had touched. It now asserts the
// APPROVED ladder: three short stops on Home, and pins the count at exactly 3
// so a fourth (or a return to ten) still bites.
requireText(treatment,
  "drop-shadow(rgba(35, 9, 2, 0.92) 0 clamp(0.5px, 0.033em, 0.68px) 0.12px)",
  "approved icon edge, first stop");
assert.equal((treatment.match(/--ww-cta-icon-shadow:[\s\S]*?\n}/)?.[0].match(/drop-shadow\(/g) || []).length, 3,
  "the Home icon variable is the approved three-stop ladder, nothing more");

// Talk -> Finish -> returned Talk keeps the same label/icon ladder in the embed.
// The embed's approved icon shadow is its own two-stop pixel ladder (route.ts
// L399/L422/L563/L582), not Home's clamp() ladder.
for (const token of [
  "html[data-ww-avatar-embedded] [data-ww-talk]",
  "html[data-ww-avatar-embedded] [data-ww-finish]",
  // Final stop of the shared Talk/Finish label ladder (route.ts L619 block).
  // 0.660 was the 08-29 value; G had the label shadow brought down twice
  // (alphas x0.81, then H475 "too dark", x0.65) - 0.385 is what ships.
  "rgba(25,6,1,0.385) 0 0.087220em 0",
  "drop-shadow(rgba(35, 9, 2, 0.9) 0px 0.75px 0px)",
]) {
  requireText(avatar, token, "embedded state parity");
}

// Compact desktop must not squeeze or animate the iScott card out of frame.
for (const token of [
  "@media (min-width: 920px) and (max-width: 1119px)",
  "grid-template-columns: minmax(0, 1fr)",
  "max-width: 48rem",
  "#talk-to-iscott.wild-iscott-panel",
  "transform: none !important",
]) {
  requireText(globals, token, "compact desktop layout");
}

// Horizontal anchoring and restrained interaction states cannot regress.
for (const token of [
  ".wild-site-avatar-overlay-cta:active",
  "transform: translateX(-50%) translateY(1px) !important",
]) {
  requireText(anchor, token, "parent Talk anchor");
}
for (const token of [
  "html[data-ww-avatar-embedded] .fixed.bottom-28:has(.btn-wood)",
  "left: 0 !important",
  "right: 0 !important",
  "margin-inline: auto !important",
  ".btn-wood:hover:not(:disabled)",
  ".btn-wood:active:not(:disabled)",
  ".btn-wood:disabled",
  "outline: 2px solid #fce0ad !important",
  "outline-offset: 2px !important",
]) {
  requireText(avatar, token, "embedded interaction contract");
}
for (const token of [
  "):hover {",
  "transform: translateY(-2px)",
  "):active:not(.wild-site-avatar-overlay-cta) {",
  "transform: translateY(1px) !important",
  "):focus-visible {",
  "outline-offset: 4px !important",
]) {
  requireText(interactions, token, "Home interaction contract");
}

// The later inline block that erased the shared material must stay gone.
assert.ok(!home.includes("Final Home action system: flat brand material with black control ink"),
  "Home page reintroduced the flat black/brown action override");
assert.ok(!home.includes("Beat legacy repeated-ID control skins without changing non-controls"),
  "Home page reintroduced the repeated-ID action override");

// Presentation work must not remove the functional owners or state hooks.
for (const token of [
  "handleIScottCtaClick",
  'aria-label="Talk to iScott"',
  "wild-site-avatar-overlay-cta",
  "LIVE_AVATAR_EMBED_URL",
]) {
  requireText(home, token, "Home functional-owner guard");
}
for (const token of ["data-ww-talk", "data-ww-finish", "data-ww-avatar-embedded"]) {
  requireText(avatar, token, "avatar state-hook guard");
}

/* ===========================================================================
   REGRESSION GUARDS, 2026-08-29.

   Everything above is a substring inventory: it proves a known-good string is
   still present. That cannot catch either of the two defects G actually saw on
   screen, because in both cases the good string WAS present and something else
   beside it was doing the damage:

     1. the corrected single icon shadow existed, but a control could still fall
        through to an older compounded fallback when the Home variable was
        scoped to only a subset of the page, and
     2. the compact-desktop rule existed, but only a token-by-token reading of
        the band proves it actually produces one column inside the viewport.

   The two guards below parse the declarations instead of grepping them, and
   each one is re-run against deliberately broken in-memory copies of the same
   source so the guard has to demonstrate that it bites.
   ======================================================================== */

const stripCssComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const abbreviate = (selector) => (selector.length > 96
  ? `...${selector.slice(-93)}`
  : selector);

// A declaration value runs to the first semicolon or closing brace that is not
// inside parentheses - var(--x, drop-shadow(...)) fallbacks nest two deep.
const readDeclarationValue = (css, colonIndex) => {
  let depth = 0;
  for (let i = colonIndex + 1; i < css.length; i += 1) {
    const character = css[i];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (depth === 0 && (character === ";" || character === "}")) {
      return css.slice(colonIndex + 1, i).trim();
    }
  }
  throw new Error("unterminated declaration while reading a value");
};

const readBlock = (css, openBraceIndex) => {
  let depth = 0;
  for (let i = openBraceIndex; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: css.slice(openBraceIndex + 1, i), end: i + 1 };
    }
  }
  throw new Error("unbalanced block");
};

const splitTopLevel = (value, isSeparator) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const character = value[i];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (depth === 0 && isSeparator(character)) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
};

const parseRules = (block) => {
  const rules = [];
  let cursor = 0;
  for (;;) {
    const open = block.indexOf("{", cursor);
    if (open === -1) return rules;
    const { body, end } = readBlock(block, open);
    rules.push({ selector: block.slice(cursor, open).trim().replace(/\s+/g, " "), body });
    cursor = end;
  }
};

const parseDeclarations = (body) => splitTopLevel(body, (character) => character === ";")
  .map((declaration) => {
    const colon = declaration.indexOf(":");
    return colon === -1
      ? null
      : {
        property: declaration.slice(0, colon).trim(),
        value: declaration.slice(colon + 1).trim(),
      };
  })
  .filter(Boolean);

/* ---------------------------------------------------------------------------
   GUARD 1: tiny Lucide icons take one shape-preserving drop-shadow, never a
   chain.

   CSS drop-shadow() chains shadow the RESULT of the previous filter, so two or
   more of them on a 20-28px outline SVG stack a dark copy on a dark copy and
   the artwork closes up into a dash or a blob. The whole 2026-08-29 repair was
   collapsing those chains to a single attached edge, so "how many
   drop-shadow() functions can this icon end up resolving" is the actual
   invariant - not "is the corrected string somewhere in the file".

   H337's shared variable and every live var() fallback must each resolve to
   the same single corrected edge. A fallback is an executable CSS value, so a
   compounded fallback would still damage controls outside the Home scope.
   ------------------------------------------------------------------------ */

const SHAPE_PRESERVING_BLUR_LIMIT_PX = 0.5;

const readParenthesised = (value, openParenIndex) => {
  let depth = 0;
  for (let i = openParenIndex; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1;
    else if (value[i] === ")") {
      depth -= 1;
      if (depth === 0) return { body: value.slice(openParenIndex + 1, i), end: i + 1 };
    }
  }
  throw new Error("unbalanced drop-shadow()");
};

const dropShadowArguments = (value) => {
  const found = [];
  const marker = "drop-shadow(";
  let cursor = value.indexOf(marker);
  while (cursor !== -1) {
    const { body, end } = readParenthesised(value, cursor + marker.length - 1);
    found.push(body);
    cursor = value.indexOf(marker, end);
  }
  return found;
};

const dropShadowBlurPx = (argumentText) => {
  const lengths = splitTopLevel(argumentText, (character) => /\s/.test(character))
    .filter((token) => !/^(#|rgba?\(|hsla?\(|color\(|currentColor$|transparent$)/i.test(token));
  assert.ok(lengths.length === 2 || lengths.length === 3,
    `drop-shadow(${argumentText}): expected "color x y [blur]", parsed ${lengths.length} lengths`);
  if (lengths.length === 2) return 0;
  const blur = /^(-?\d*\.?\d+)(px)?$/.exec(lengths[2]);
  assert.ok(blur,
    `drop-shadow(${argumentText}): blur "${lengths[2]}" is not a plain px length, so its softness cannot be audited`);
  return Number(blur[1]);
};

// 2026-09-03: was "exactly one". G's approved icon shadow (commit 7334130,
// 2026-09-01, "the approved icon shadow across the whole site") is a ladder of
// THREE sub-pixel stops (0.5-0.68px offsets, 0.12px blur) - a hugging edge, not
// the ten-stop "hideous" chain this guard was written against. The ceiling is
// now 3 and EVERY stop must stay shape-preserving, so a return to ten, or any
// soft stop, still bites.
const MAX_ATTACHED_STOPS = 3;
const assertSingleAttachedShadow = (value, label) => {
  const shadows = dropShadowArguments(value);
  assert.ok(shadows.length >= 1 && shadows.length <= MAX_ATTACHED_STOPS,
    `${label}: resolves to ${shadows.length} drop-shadow() functions; the approved edge is 1-${MAX_ATTACHED_STOPS} `
    + `sub-pixel stops. A long chain shadows the previous shadow, which is what turned these 20-28px Lucide `
    + `outlines into dashes and blobs.`);
  for (const shadow of shadows) {
    const blur = dropShadowBlurPx(shadow);
    assert.ok(blur <= SHAPE_PRESERVING_BLUR_LIMIT_PX,
      `${label}: blur ${blur}px exceeds the ${SHAPE_PRESERVING_BLUR_LIMIT_PX}px shape-preserving limit, `
      + `so the shadow spreads past the stroke instead of hugging it`);
  }
};

const selectorForDeclarationAt = (css, declarationIndex) => {
  const open = css.lastIndexOf("{", declarationIndex);
  const boundary = Math.max(
    css.lastIndexOf("}", open),
    css.lastIndexOf("{", open - 1),
    css.lastIndexOf(";", open),
    css.lastIndexOf("`", open),
  );
  return css.slice(boundary + 1, open).trim().replace(/\s+/g, " ");
};

const findFilterDeclarations = (source) => {
  const css = stripCssComments(source);
  const declarations = [];
  const pattern = /(?:^|[;{}\s])filter\s*:/g;
  let match = pattern.exec(css);
  while (match !== null) {
    const colon = css.indexOf(":", match.index);
    declarations.push({
      selector: selectorForDeclarationAt(css, match.index),
      value: readDeclarationValue(css, colon),
    });
    match = pattern.exec(css);
  }
  return declarations;
};

const assertIconShadowContract = (sources) => {
  const cleanTreatment = stripCssComments(sources.treatment);
  const variables = [...cleanTreatment.matchAll(/--ww-cta-icon-shadow\s*:/g)];
  assert.equal(variables.length, 1,
    `shared Home icon depth: expected one --ww-cta-icon-shadow declaration, found ${variables.length}`);
  const [variable] = variables;
  assert.ok(variable, "shared Home icon depth: --ww-cta-icon-shadow is no longer declared");
  assertSingleAttachedShadow(
    readDeclarationValue(cleanTreatment, cleanTreatment.indexOf(":", variable.index)),
    "shared Home icon variable --ww-cta-icon-shadow");
  const variableSelector = selectorForDeclarationAt(cleanTreatment, variable.index);
  assert.equal(variableSelector, "html:has(#top.wild-home)",
    `shared Home icon variable is owned by "${abbreviate(variableSelector)}", not the Home page root. `
    + `A subset selector lets shared header/footer/card icons fall through to compounded fallbacks.`);

  // Every H337 Lucide SVG rule still consumes the variable, and its sitewide
  // fallback independently obeys the same single-edge contract.
  const iconRules = findFilterDeclarations(sources.treatment)
    .filter((rule) => /\bsvg\b/.test(rule.selector));
  assert.ok(iconRules.length >= 3,
    `Home icon filters: expected the SVG filter rules to still exist, found ${iconRules.length}`);
  for (const rule of iconRules) {
    assert.ok(rule.value.includes("var(--ww-cta-icon-shadow"),
      `Home icon filter for "${abbreviate(rule.selector)}" stopped reading the shared variable, `
      + `so correcting the variable can no longer correct this icon`);
    assertSingleAttachedShadow(rule.value,
      `Home icon filter for "${abbreviate(rule.selector)}"`);
  }

  // The embedded Talk/Finish glyphs, which live in the avatar document and are
  // painted by whichever rule wins there. Both states draw the sparkle two
  // different ways - a ::before background-image and a real svg - so the
  // winning rule has to cover all four surfaces.
  const talkFinishIconRules = findFilterDeclarations(sources.avatar)
    .filter((rule) => /data-ww-(talk|finish)/.test(rule.selector) && /(svg|::before)/.test(rule.selector));
  assert.ok(talkFinishIconRules.length > 0,
    "embedded iScott icons: no filter rule targets the Talk/Finish glyphs at all");
  const finalRule = talkFinishIconRules[talkFinishIconRules.length - 1];
  // The accepted later rule covers the complete avatar document, including the
  // embed. Repeated specificity guards and :is() do not remove that coverage.
  // This checks declared coverage/depth; a rendered cascade audit is separate.
  const finalSelector = finalRule.selector.replaceAll(":not(#_)", "");
  for (const surface of [
    "[data-ww-talk]::before",
    "[data-ww-finish]::before",
    "[data-ww-talk] svg",
    "[data-ww-finish] svg",
  ]) {
    assert.ok(finalSelector.includes(`html ${surface}`)
      || finalSelector.includes(`html[data-ww-avatar-embedded] ${surface}`),
      `embedded iScott icons: the corrected rule does not cover ${surface}, so that surface keeps an older shadow`);
  }
  assertSingleAttachedShadow(finalRule.value, "embedded iScott Talk/Finish icon filter");
  assert.equal(dropShadowArguments(finalRule.value).length, 1,
    "the final avatar icon treatment must keep its accepted single attached shadow");
};

/* ---------------------------------------------------------------------------
   GUARD 2: the compact desktop iScott band.

   Between the tablet breakpoint and 1120px the two-column lead split had a
   390px card minimum next to the large Front Door copy, and the right
   card/header read as cropped. The repair is an explicit 920-1119px band that
   drops to one column, keeps both children inside a container narrower than
   the band's own narrowest viewport, and cancels the entrance transform that
   would otherwise start the card off the right edge.

   This is checked as geometry, not as text: one grid track, a container that
   fits inside 920px, a copy column no wider than that container, and a panel
   with no transform left to clip it.
   ------------------------------------------------------------------------ */

const COMPACT_BAND = "@media (min-width: 920px) and (max-width: 1119px)";
const BASE_DESKTOP_BAND = "@media (min-width: 920px) {";
const COMPACT_BAND_MIN_VIEWPORT_PX = 920;
const ROOT_FONT_PX = 16;

const remToPx = (value, label) => {
  const rem = /^([\d.]+)rem$/.exec(value.replace("!important", "").trim());
  assert.ok(rem, `${label}: expected a rem length, got "${value}"`);
  return Number(rem[1]) * ROOT_FONT_PX;
};

const findBand = (css, marker) => {
  const start = css.indexOf(marker);
  if (start === -1) return null;
  const { body, end } = readBlock(css, css.indexOf("{", start));
  return { start, end, body };
};

const assertCompactIScottBand = (globalsSource) => {
  const css = stripCssComments(globalsSource);

  const compact = findBand(css, COMPACT_BAND);
  assert.ok(compact,
    `compact desktop iScott: the explicit "${COMPACT_BAND}" band is gone. Without both bounds the `
    + `crop returns somewhere inside 920-1119px, which is exactly the range that failed.`);
  assert.equal(css.indexOf(COMPACT_BAND, compact.start + 1), -1,
    "compact desktop iScott: the band is declared twice, so which composition wins is order-dependent");

  // The band only matters if it still overrides the base desktop pair.
  let baseStart = -1;
  let cursor = css.indexOf(BASE_DESKTOP_BAND);
  while (cursor !== -1 && baseStart === -1) {
    const { body } = readBlock(css, css.indexOf("{", cursor));
    if (body.includes("#iscott-sales .wild-split--lead")) baseStart = cursor;
    cursor = css.indexOf(BASE_DESKTOP_BAND, cursor + 1);
  }
  assert.notEqual(baseStart, -1,
    "compact desktop iScott: the base 920px lead split is gone, so the compact band overrides nothing");
  assert.ok(compact.start > baseStart,
    "compact desktop iScott: the compact band is declared before the base 920px split, "
    + "so at equal specificity the two-column rule wins and the card crops again");

  const rules = parseRules(compact.body);
  const pick = (test, label) => {
    const rule = rules.find((candidate) => test(candidate.selector));
    assert.ok(rule, `compact desktop iScott: no rule in the band targets ${label}`);
    return { ...rule, declarations: parseDeclarations(rule.body) };
  };
  const declaration = (rule, property, label) => {
    const found = rule.declarations.find((entry) => entry.property === property);
    assert.ok(found, `compact desktop iScott: ${label} does not set ${property}`);
    return found.value;
  };

  // Home only: this band must not restyle iScott sections on other pages.
  for (const rule of rules) {
    assert.ok(rule.selector.includes("#top.wild-home"),
      `compact desktop iScott: "${abbreviate(rule.selector)}" is not Home-scoped, so the band leaks off Home`);
  }

  const split = pick(
    (selector) => selector.includes("#iscott-sales") && selector.includes(".wild-split--lead"),
    "#iscott-sales .wild-split--lead");
  // Track lists are whitespace-separated at the top level; the commas belong to
  // minmax()/repeat(). repeat(n, ...) is one token but n columns.
  const tracks = splitTopLevel(
    declaration(split, "grid-template-columns", "the lead split"),
    (character) => /\s/.test(character))
    .flatMap((track) => {
      const repeat = /^repeat\(\s*(\d+)\s*,/.exec(track);
      return repeat ? Array.from({ length: Number(repeat[1]) }, () => track) : [track];
    });
  assert.equal(tracks.length, 1,
    `compact desktop iScott: the lead split still declares ${tracks.length} columns (${tracks.join(" | ")}). `
    + `A second track re-imposes the 390px card minimum beside the Front Door copy and crops the card.`);
  const splitWidthPx = remToPx(declaration(split, "max-width", "the lead split"), "lead split max-width");
  assert.ok(splitWidthPx <= COMPACT_BAND_MIN_VIEWPORT_PX,
    `compact desktop iScott: the lead split is capped at ${splitWidthPx}px, wider than the band's own `
    + `narrowest viewport (${COMPACT_BAND_MIN_VIEWPORT_PX}px), so the copy and panel are not contained`);

  const copy = pick((selector) => selector.includes(".wild-copy-stack"), ".wild-copy-stack");
  const copyWidthPx = remToPx(declaration(copy, "max-width", "the copy stack"), "copy stack max-width");
  assert.ok(copyWidthPx <= splitWidthPx,
    `compact desktop iScott: the copy stack (${copyWidthPx}px) is wider than its own container `
    + `(${splitWidthPx}px), so the copy overflows the compact content width`);

  const panel = pick((selector) => selector.includes("#talk-to-iscott"), "#talk-to-iscott.wild-iscott-panel");
  const transform = declaration(panel, "transform", "the iScott panel");
  assert.match(transform, /^none\s*!important$/,
    `compact desktop iScott: the panel transform is "${transform}". The entrance animation sets an inline `
    + `horizontal transform, so anything but "none !important" can start the card off the right edge.`);
  assert.match(declaration(panel, "opacity", "the iScott panel"), /^1\s*!important$/,
    "compact desktop iScott: the panel must be forced fully opaque alongside the cancelled transform");
  for (const offset of ["margin-left", "margin-inline-start", "left", "translate", "inset-inline-start"]) {
    assert.ok(!panel.declarations.some((entry) => entry.property === offset),
      `compact desktop iScott: the panel reintroduces a horizontal offset via ${offset}, `
      + `which can push the card/header back out of frame`);
  }
};

/* ---------------------------------------------------------------------------
   Negative self-checks. Each fixture is a mutation of the REAL source held in
   memory - nothing is written to disk - and each one must make the guard above
   throw. A fixture whose anchor no longer matches fails loudly rather than
   silently passing, so these cannot rot into no-ops.
   ------------------------------------------------------------------------ */

const mutate = (source, from, to, label) => {
  assert.ok(source.includes(from), `negative fixture "${label}": anchor ${JSON.stringify(from)} not found`);
  const mutated = source.replace(from, to);
  assert.notEqual(mutated, source, `negative fixture "${label}": mutation changed nothing`);
  return mutated;
};

const removeRule = (source, selectorAnchor, label) => {
  const start = source.indexOf(selectorAnchor);
  assert.notEqual(start, -1, `negative fixture "${label}": anchor ${JSON.stringify(selectorAnchor)} not found`);
  const { end } = readBlock(source, source.indexOf("{", start));
  return source.slice(0, start) + source.slice(end);
};

const mutateBand = (source, transform, label) => {
  const start = source.indexOf(COMPACT_BAND);
  assert.notEqual(start, -1, `negative fixture "${label}": the compact band anchor is missing`);
  const { end } = readBlock(source, source.indexOf("{", start));
  const mutated = source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end);
  assert.notEqual(mutated, source, `negative fixture "${label}": mutation changed nothing`);
  return mutated;
};

const SECOND_SHADOW = " drop-shadow(rgba(25, 6, 1, 0.6) 0 1.5px 0)";

// Mutate the current declaration itself, rather than retired literal values.
const mutateSharedIcon = (transform) => {
  const clean = stripCssComments(treatment);
  const start = clean.indexOf("--ww-cta-icon-shadow:");
  assert.notEqual(start, -1, "fixture cannot find the shared icon variable");
  const colon = clean.indexOf(":", start);
  const value = readDeclarationValue(clean, colon);
  const valueStart = clean.indexOf(value, colon + 1);
  const replacement = transform(value);
  assert.notEqual(replacement, value, "fixture did not change the shared icon value");
  return clean.slice(0, valueStart) + replacement + clean.slice(valueStart + value.length);
};
const appendAvatarIconRule = (transformSelector, transformValue) => {
  const rule = findFilterDeclarations(avatar)
    .filter((r) => /data-ww-(talk|finish)/.test(r.selector) && /(svg|::before)/.test(r.selector)).at(-1);
  assert.ok(rule, "fixture cannot find the final avatar icon rule");
  return `${avatar}\n${transformSelector(rule.selector)} { filter: ${transformValue(rule.value)}; }`;
};

// Records the assertion each fixture tripped, so the run prints proof that the
// guard rejected the break for the intended reason rather than by accident.
const expectRejection = (label, run) => {
  let rejection = null;
  assert.throws(run, (error) => {
    assert.ok(error instanceof assert.AssertionError,
      `negative self-check "${label}": expected a guard assertion, got ${error}`);
    rejection = String(error.message).split("\n")[0];
    return true;
  }, `negative self-check "${label}": the guard accepted a source it must reject`);
  console.log(`  rejected "${label}"\n    -> ${rejection}`);
};

const iconFixtures = [
  ["compounded shared icon variable", () => ({
    treatment: mutateSharedIcon((value) => value.replace("!important", `${SECOND_SHADOW} !important`)),
    avatar,
  })],
  ["Home icon variable narrowed off the page root", () => ({
    treatment: mutate(treatment,
      "html:has(#top.wild-home) {\n  /* PASS 5 on the icons",
      "html:has(#top.wild-home) body#wildworks-body .money-cta {\n  /* PASS 5 on the icons",
      "Home icon variable narrowed off the page root"),
    avatar,
  })],
  ["Home icon shadow blurred off its stroke", () => ({
    treatment: mutateSharedIcon((value) => value.replace("0.12px)", "4px)")),
    avatar,
  })],
  ["Home icon filter stops reading the shared variable", () => ({
    treatment: mutate(treatment, "filter: var(--ww-cta-icon-shadow,", "filter: unset;\n  filter: var(--nope,",
      "Home icon filter stops reading the shared variable"),
    avatar,
  })],
  ["compounded embedded Talk/Finish icon", () => ({
    treatment,
    avatar: appendAvatarIconRule((selector) => selector,
      (value) => value.replace("!important", `${SECOND_SHADOW} !important`)),
  })],
  ["final avatar correction loses Talk coverage", () => ({
    treatment,
    avatar: appendAvatarIconRule((selector) => selector.replaceAll("data-ww-talk", "data-ww-missing"), (value) => value),
  })],
];

const bandFixtures = [
  ["compact band deleted", () => {
    const start = globals.indexOf(COMPACT_BAND);
    assert.notEqual(start, -1, 'negative fixture "compact band deleted": anchor missing');
    const { end } = readBlock(globals, globals.indexOf("{", start));
    return globals.slice(0, start) + globals.slice(end);
  }],
  ["compact band no longer reaches 1119px", () => mutate(globals,
    "and (max-width: 1119px)", "and (max-width: 1099px)",
    "compact band no longer reaches 1119px")],
  ["two columns restored inside the band", () => mutateBand(globals,
    (band) => band.replace("grid-template-columns: minmax(0, 1fr);",
      "grid-template-columns: minmax(0, 0.9fr) minmax(390px, 0.82fr);"),
    "two columns restored inside the band")],
  ["container wider than the band's narrowest viewport", () => mutateBand(globals,
    (band) => band.replace("max-width: 48rem;", "max-width: 72rem;"),
    "container wider than the band's narrowest viewport")],
  ["copy stack wider than its container", () => mutateBand(globals,
    (band) => band.replace("max-width: 46rem;", "max-width: 52rem;"),
    "copy stack wider than its container")],
  ["panel transform left in place", () => mutateBand(globals,
    (band) => band.replace("transform: none !important;", "transform: translateX(28px) !important;"),
    "panel transform left in place")],
  ["panel offset reintroduced", () => mutateBand(globals,
    (band) => band.replace("transform: none !important;",
      "transform: none !important;\n    margin-left: 6rem;"),
    "panel offset reintroduced")],
  ["band leaks off Home", () => mutateBand(globals,
    (band) => band.replace("#top.wild-home #iscott-sales .wild-copy-stack", "#iscott-sales .wild-copy-stack"),
    "band leaks off Home")],
];

// Current source must pass both guards...
assertIconShadowContract({ treatment, avatar });
assertCompactIScottBand(globals);

// ...and both guards must reject every representative break.
console.log("Home icon shadow contract, negative self-checks:");
for (const [label, build] of iconFixtures) {
  const broken = build(); // A broken fixture is an error, never a successful rejection.
  expectRejection(label, () => assertIconShadowContract(broken));
}
console.log("Compact desktop iScott band, negative self-checks:");
for (const [label, build] of bandFixtures) {
  const broken = build();
  expectRejection(label, () => assertCompactIScottBand(broken));
}

console.log(`Home icon shadow contract: PASS (${iconFixtures.length} negative fixtures rejected)`);
console.log(`Compact desktop iScott band: PASS (${bandFixtures.length} negative fixtures rejected)`);
console.log("Home button visual-system source contract: PASS");
