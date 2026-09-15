"use client";

import { useLayoutEffect } from "react";

const CONTROL_SELECTOR = [
  "button",
  "[role='button']",
  "input[type='submit']",
  "a.money-cta",
  "a.wild-card-cta",
  "a.wild-sell-feature-cta",
  "a.wild-utility-button",
  "a.wild-signup-choice-button",
  "a.wild-signup-submit",
  "a.wild-footer-top-button",
  "a.wild-footer-mobile-link",
  "a.wild-home-phone-iscott-test__button",
  "a.wild-iscott-action-button",
  "a.wild-iscott-upload__button",
  "a.wild-site-avatar-overlay-cta",
  "a.wild-story-action",
  "a.wild-story-cta",
  "a.wild-logo-download-button",
  "a.wild-wildfire-photo-button",
  "a.btn-wood",
  "a[class*='button']",
  "a[class*='cta']",
].join(",");

const ICON_SELECTOR =
  "svg, i, .icon, .wild-iscott-upload__icon, .ww-mail, .ww-phone, .ww-talk-arc-cluster";

// G's latest direction: exactly ONE opaque black, straight-down shadow.
// Lighter large text, more defined controls, approved body depth preserved.
const HOME_SHADOW_FALLBACK_PX = 16;
const HOME_RENDERED_SHADOW_OFFSET_PX = 0.5;
// Tie scaled button paint to its own scale token, without a JS measurement race.
const HOME_CLONE_TEXT_SHADOW = "0 calc(1.25px / var(--ww-iscott-clone-scale, 1)) 0 #000";
const HOME_LARGE_TEXT_MIN_PX = 28;
const HOME_CAPTION_SELECTOR = ".wild-iscott-kicker__color, .money-panel-kicker, .wild-kicker-frame";
const HOME_LIGHT_ISCOTT_CONTROLS =
  "#top.wild-home .wild-site-avatar-overlay-cta, #top.wild-home .wild-iscott-upload__button";
const HOME_CTA_SELECTOR = [
  "a.wild-home-phone-iscott-test__button",
  "a.wild-iscott-action-button",
  "a.wild-site-avatar-overlay-cta",
].join(",");
const HOME_LOGO_FAMILY =
  ".wild-top-logo, .wild-top-logo-tagline, .wild-top-logo-living, .wild-home-statement__brand-lockup";
const HOME_DISPLAY_TEXT_SELECTOR = [
  ".wild-start-title",
  ".wild-home-statement__title",
  ".wild-wildfire-sequence-callout",
  ".wild-wildfire-build-note",
  ".wild-signup-title",
  ".wild-footer-contact-cta__title",
  ".wild-footer-contact-cta__kicker-line",
  ".wild-kicker-frame",
  ".wildfire-page-heading",
  ".wildfire-page-heading__project",
  ".wildfire-page-heading__wildfire",
  ".wild-subpage--ruins h1",
  ".wild-subpage--ruins h2",
  ".wild-projects-page-title",
  ".wild-subpage--bio h1",
  ".wild-bio-reinvention-heading",
].join(",");
// Five-majors large-display inventory: keep accepted Home entries EXACT;
// append Wildfire/Ruins/Projects/Bio display titles only. Fail-closed
// outside fiveMajorsOnly; never legal / --sell. No generic .wild-line-title.
const HOME_LARGE_DOUBLE_SELECTOR = [
  ".wild-hero-headline",
  ".wild-hero-wordmark-text-orange",
  ".wild-home-statement__title",
  ".wild-iscott-title--front-door",
  ".wild-section-title",
  ".wild-tree-title",
  ".wild-signature-title",
  "#signature-work .wild-story-card--feature .wild-story-copy > .wild-line-title",
  ".wild-sell-feature-title",
  ".wild-home-projects__title",
  ".wild-wildfire-sequence-callout",
  ".wild-wildfire-flame-title__text",
  ".wild-services-title__wildworks",
  ".wild-phone-number-line",
  // Subpage large non-button display (match accepted Home 3px desktop).
  // Rendered Ruins h2s are 108px on desktop; final iScott display is 61.6px.
  ".wildfire-page-heading",
  ".wildfire-page-heading__project",
  ".wildfire-page-heading__wildfire",
  ".wildfire-hero-headline",
  ".wildfire-hero-headline__line",
  ".wild-subpage--ruins h1",
  ".wild-subpage--ruins h2",
  ".wild-iscott-prompt--ruins-single .wild-iscott-prompt__ask",
  ".wild-projects-page-title",
  ".wild-subpage--bio h1",
  "#ww-bio-primary-heading",
  ".wild-bio-reinvention-heading",
].join(",");
// Medium display inventory (Scott 2026-09-14 + avatar-panel steering):
// mid-size lettering that still showed orange separation gap.
// Includes avatar-panel lettering: Concierge + Start with iScott
// (FooterIScottPanel + Home #talk-to-iscott). Talk to iScott CTA stays
// on CONTROL path (Chief freeze). Moved off HOME_LARGE_DOUBLE.
// Unrelated small/body kickers frozen. Font-size rationale in NOTES.
const HOME_MEDIUM_DISPLAY_SELECTOR = [
  // Avatar-panel / Concierge kickers (Home mid-page + footer panel, all five majors)
  ".wild-iscott-kicker__color",
  ".money-panel-kicker",
  // Avatar-panel card title: "Start with iScott"
  ".wild-start-title",
  // Home hero lede lines (Beautiful / Problems / italic mid)
  ".wild-hero-lede-line",
  // Home fireplace lede + build note (mid under Project Wildfire)
  ".wild-wildfire-title",
  ".wild-wildfire-build-note",
  // Wildfire page summary / gallery note
  ".wildfire-hero-summary",
  ".wildfire-gallery-rolodex-note",
  // Projects mid display
  ".wild-projects-page-intro",
  ".wild-projects-page-kicker",
  // Footer medium display (Scott signup / conversation shot)
  ".wild-signup-title",
  ".wild-footer-contact-cta__title",
  ".wild-footer-contact-cta__kicker-line",
  ".wild-footer-stonework-note",
  ".wild-footer-aiasap-link",
  ".wild-footer-aiasap-wordmark",
  // Home Services / Ai-Native mid kickers only (scoped)
  "#services .wild-kicker-frame",
  "#ai-websites .wild-site-offer-heading > .wild-kicker--framed",
].join(",");
// Alias kept so named-caption references stay wired to medium.
const HOME_NAMED_CAPTION_DOUBLE_SELECTOR = HOME_MEDIUM_DISPLAY_SELECTOR;

function homeShadowDepthPx(offsetPx: number, large: boolean, control = false, caption = false) {
  // Rendered depths: body 1px; named captions and controls 1.25px;
  // G-approved September 7 22:06:58 reference: large lettering 2.5px.
  // Keep one offset, H537 controls, and the lighter Home Talk/Upload at 1px.
  return Number((offsetPx * (control ? 2.5 : caption ? 2.5 : large ? 5 : 2)).toFixed(4));
}

function homeConnectedTextShadow(offsetPx: number, large: boolean, control = false, caption = false) {
  return `0 ${homeShadowDepthPx(offsetPx, large, control, caption)}px 0 #000`;
}

function homeConnectedDropFilter(offsetPx: number, large: boolean, control = false) {
  return `drop-shadow(${homeConnectedTextShadow(offsetPx, large, control)})`;
}

function homePaintScale(
  element: Element,
  computed: CSSStyleDeclaration,
  scales: WeakMap<Element, number>,
): number {
  const cached = scales.get(element);
  if (cached !== undefined) return cached;
  const parent = element.parentElement;
  const parentScale = parent
    ? scales.get(parent) ?? homePaintScale(parent, getComputedStyle(parent), scales)
    : 1;
  const positiveScale = (value: string) => {
    const parsed = parseFloat(value) / (value.endsWith("%") ? 100 : 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };
  const matrix = computed.transform === "none" ? null : new DOMMatrixReadOnly(computed.transform);
  const transformY = matrix ? Math.hypot(matrix.m21, matrix.m22, matrix.m23) : 1;
  const scaleParts = computed.scale.trim().split(/\s+/);
  const ownScaleY = positiveScale(scaleParts[1] ?? scaleParts[0]);
  const result = parentScale * transformY * ownScaleY * positiveScale(computed.zoom);
  scales.set(element, result);
  return result;
}


function withoutDropShadows(value: string) {
  let output = "";
  let cursor = 0;
  while (cursor < value.length) {
    const match = /drop-shadow\s*\(/i.exec(value.slice(cursor));
    if (!match) return (output + value.slice(cursor)).trim() || "none";
    const start = cursor + match.index;
    output += value.slice(cursor, start);
    let end = start + match[0].length;
    let depth = 1;
    while (end < value.length && depth) {
      if (value[end] === "(") depth++;
      if (value[end] === ")") depth--;
      end++;
    }
    cursor = end;
  }
  return output.trim() || "none";
}

export default function ZeroShadowEnforcer() {
  useLayoutEffect(() => {
    const sheet = document.createElement("style");
    sheet.dataset.wwZeroShadows = "true";
    document.head.appendChild(sheet);
    const pseudoRules = new Map<string, string>();
    let serial = 0;
    let frame = 0;
    let scrollSettleTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const watchedAnimations = new WeakSet<Animation>();
    const options = { subtree: true, childList: true, attributes: true,
      attributeFilter: ["style", "class"] };
    const enforce = () => {
      observer.disconnect();
      let changedRules = false;
      const logoMenuAllowed = !document.querySelector(".wild-legal-home") &&
        Boolean(document.querySelector("#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio"));
      // G, 2026-09-08: the four named subpages share the approved Home paint.
      // Legal documents remain excluded; Home's bands and exceptions are unchanged.
      const referenceShadowsAllowed = !document.querySelector(".wild-legal-home") &&
        Boolean(document.querySelector("#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio"));
      // G: complete contact correction on the five main pages at every width.
      const compactContact = referenceShadowsAllowed;
      // Five-majors double: Home inventory unchanged; subpages get same desktop 3/2.
      // Fail closed on legal and non-major wild-subpage variants (e.g. --sell).
      // Phone: large-double / logo keep live depths. Medium sweet-spot phone*1.5/desk*2 (WW-MEDIUM-SWEET-SPOT; midway too-far large-match and too-close *1). Body/control/clone exact homeOffset. Logo/signup not in this delta.
      const fiveMajorsOnly = !document.querySelector(".wild-legal-home") &&
        Boolean(document.querySelector(
          "#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio",
        ));
      const phoneViewport = window.matchMedia("(max-width: 719px)").matches;
      const homeScales = new WeakMap<Element, number>();
      for (const element of document.querySelectorAll<HTMLElement | SVGElement>("body, body *")) {
        const computed = getComputedStyle(element);
        const homeOffset = referenceShadowsAllowed
          ? Number((HOME_RENDERED_SHADOW_OFFSET_PX /
              Math.max(0.05, homePaintScale(element, computed, homeScales))).toFixed(4))
          : HOME_RENDERED_SHADOW_OFFSET_PX;
        const inReferenceCta = referenceShadowsAllowed && Boolean(element.closest(HOME_CTA_SELECTOR));
        const referenceCopy = referenceShadowsAllowed &&
          // G explicitly reopened the signup input on all five main pages.
          !element.matches("script, style") &&
          (Array.from(element.childNodes).some(node =>
            node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())) ||
            (element instanceof HTMLInputElement && Boolean(element.value || element.placeholder)) ||
            (element instanceof HTMLTextAreaElement && Boolean(element.value || element.placeholder)) ||
            element instanceof HTMLSelectElement ||
            (inReferenceCta && element.matches(
              "span, .wild-iscott-clone-label, a.wild-home-phone-iscott-test__button, a.wild-iscott-action-button, a.wild-site-avatar-overlay-cta",
            )));
        if (referenceCopy) {
          const fontPx = parseFloat(computed.fontSize) || HOME_SHADOW_FALLBACK_PX;
          const large = !inReferenceCta && !element.closest(CONTROL_SELECTOR) &&
            (fontPx >= HOME_LARGE_TEXT_MIN_PX || Boolean(element.closest(HOME_DISPLAY_TEXT_SELECTOR)));
          // G via Grok, 2026-09-08 20:26 ET: afternoon reference, with only
          // avatar Start title 1.0625px and Front Door 1.125px stay fixed.
          // Keep the original native renderer and its scale compensation.
          const shadow = element.closest("#talk-to-iscott .wild-start-title, .wild-iscott-panel--footer .wild-start-title")
            ? homeConnectedTextShadow(homeOffset * 0.85, false, true)
            : element.closest("#top.wild-home .wild-iscott-title--front-door")
            ? homeConnectedTextShadow(homeOffset * 0.9, false, true)
            : element.closest(HOME_LIGHT_ISCOTT_CONTROLS)
            ? homeConnectedTextShadow(homeOffset, false)
            : element.closest(".wild-iscott-clone-surface")
            ? HOME_CLONE_TEXT_SHADOW
            : homeConnectedTextShadow(homeOffset, large,
            Boolean(element.closest(CONTROL_SELECTOR)),
            Boolean(element.closest(HOME_CAPTION_SELECTOR)));
          // A displaced 2.5px copy separates from thin strokes at any width. Use one
          // native offset: 1px body and 1.5px large ink; approved controls
          // retain their existing paint. Never add strokes or shadow layers.
          // Five majors: desktop large 3px / captions 2px. Phone flush only those + logo.
          // Body/control/Talk/Upload/clone keep exact homeOffset. One #000 downward. CONTROL wins.
                    // Medium display flush (WW-MEDIUM-LETTER-FLUSH): check MEDIUM first
          // so dual-class nodes (e.g. wild-wildfire-title + wild-section-title,
          // avatar-panel start-title) sweet-spot phone*1.5/desk*2 (WW-MEDIUM-SWEET-SPOT-20260915; five majors + avatars).
          const homeMediumDouble = fiveMajorsOnly &&
            Boolean(element.closest(HOME_MEDIUM_DISPLAY_SELECTOR));
          const homeLargeDouble = fiveMajorsOnly && !homeMediumDouble &&
            Boolean(element.closest(HOME_LARGE_DOUBLE_SELECTOR));
          const homeCaptionDouble = homeMediumDouble; // back-compat alias
          // Scott exact (via Codex WW-MEDIUM-MATCH-HEAVY-LARGE-20260915): match heavier large shadow on medium-size letters.
          // Medium authorizedMult now shares large phone*2 / desk*3. Small/body final branch FROZEN. Logo/control/legal untouched.
          // SUPERSEDES middle-ground *1.5 only for medium; does NOT change logoMult or signup exclusion (signup stays WW-SIGNUP R3).
          // Scott 2026-09-15: medium a little too far; sweet spot middle of too-far & too-close.
          // Large kept phone*2/desk*3. Medium phone*1.5/desk*2. Small/body/legal/logo/signup untouched.
          const authorizedMult = homeLargeDouble
            ? (phoneViewport ? 2 : 3)
            : homeMediumDouble
            ? (phoneViewport ? 1.5 : 2)
            : large ? 1.5 : 1;
          const signupFieldInput = fiveMajorsOnly &&
            element.matches("footer#footer .wild-signup-field input");
          const signupShadow = homeConnectedTextShadow(homeOffset, false, true);
          const topDown = signupFieldInput
            ? signupShadow
            : compactContact && !element.closest(CONTROL_SELECTOR)
            ? homeConnectedTextShadow(
                homeOffset * authorizedMult,
                false,
              )
            : shadow;
          if (element.style.getPropertyValue("text-shadow") !== topDown) {
            element.style.setProperty("text-shadow", topDown, "important");
          }
          if (signupFieldInput) {
            element.style.setProperty("--ww-signup-control-shadow", signupShadow);
            const inputSelector =
              "html:has(#top.wild-home:not(.wild-legal-home), .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio) " +
              "body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body#wildworks-body footer#footer#footer#footer " +
              ".wild-signup-field input";
            pseudoRules.set(
              "ww-signup-field-control-shadow",
              `${inputSelector}{text-shadow:var(--ww-signup-control-shadow, ${signupShadow}) !important;}` +
              `${inputSelector}::placeholder{text-shadow:var(--ww-signup-control-shadow, ${signupShadow}) !important;}`,
            );
            changedRules = true;
          }
          // WebKit can suppress a valid text-shadow when legacy stroke-first
          // paint meets a zero-width stroke. Restore normal glyph painting only
          // on this five-page text path; preserve any real stroke and all legal.
          if (parseFloat(computed.webkitTextStrokeWidth) === 0 && computed.paintOrder !== "normal") {
            element.style.setProperty("paint-order", "normal", "important");
          }
        }
        for (const property of ["text-shadow", "box-shadow"]) {
          const allowedMenuText = property === "text-shadow" && logoMenuAllowed &&
            element.matches(".wild-nav-link, .wild-mobile-nav-link");
          if (!allowedMenuText && !(referenceCopy && property === "text-shadow") && computed.getPropertyValue(property) !== "none") {
            element.style.setProperty(property, "none", "important");
          }
        }
        const homeButtonIcon = referenceShadowsAllowed &&
          element.matches(ICON_SELECTOR) &&
          !element.matches(".wild-top-logo, .ww-home-btn-icon__shadow") &&
          Boolean(element.closest(CONTROL_SELECTOR));
        if (referenceShadowsAllowed && element.matches(HOME_LOGO_FAMILY)) {
          // Logo lettering: .wild-top-logo + tagline (HOME_LOGO_FAMILY). Not hero/photo.
          // Scott 2026-09-15: logo shadow needs substantially more — match large weight
          // (phone *2 / desk *3), top-down #000 only. Five majors. Artwork frozen.
          // Prior flush *1/*1.5 was too light vs large/medium work. Native drop-filter only.
          const logoMult = phoneViewport ? 2 : 3;
          element.style.setProperty("filter",
            homeConnectedDropFilter(homeOffset * logoMult, false), "important");
        } else if (homeButtonIcon) {
          const filter = element.closest(HOME_LIGHT_ISCOTT_CONTROLS)
            ? homeConnectedDropFilter(homeOffset, false)
            : element.closest(".wild-iscott-clone-surface")
            ? `drop-shadow(${HOME_CLONE_TEXT_SHADOW})`
            : homeConnectedDropFilter(homeOffset, false, true);
          element.style.setProperty("filter", filter, "important");
        } else if (computed.filter.includes("drop-shadow(") &&
            !(logoMenuAllowed && element.matches(".wild-top-logo"))) {
          element.style.setProperty("filter", withoutDropShadows(computed.filter), "important");
        }
        for (const pseudo of ["::before", "::after", "::marker"]) {
          const filter = getComputedStyle(element, pseudo).filter;
          if (!filter.includes("drop-shadow(")) continue;
          const key = element.dataset.wwShadowId || String(++serial);
          element.dataset.wwShadowId = key;
          const selector = `[data-ww-shadow-id="${key}"]${pseudo}`;
          // The logo host already paints its shadow. Preserve the cream face
          // and remove duplicate pseudo filters; never repaint a face black.
          pseudoRules.set(selector, `${selector}{filter:${withoutDropShadows(filter)} !important;}`);
          changedRules = true;
        }
      }
      if (changedRules) {
        const nextRules = `@layer wildworks-zero-shadows {${[...pseudoRules.values()].join("\n")}}`;
        if (sheet.textContent !== nextRules) sheet.textContent = nextRules;
      }
      observer.observe(document.body, options);
      // Motion's Web Animations do not emit CSS animationend events. Watch
      // each current animation once and measure again when its final scale lands.
      for (const animation of referenceShadowsAllowed ? document.getAnimations() : []) {
        if (watchedAnimations.has(animation) || animation.playState === "finished") continue;
        watchedAnimations.add(animation);
        animation.finished.then(() => requestAnimationFrame(schedule), () => undefined);
      }
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enforce);
    };
    // Scroll-triggered Motion animations may start without an observed style
    // mutation. One debounced pass discovers them after scrolling pauses.
    const scheduleAfterScroll = () => {
      if (document.querySelector(".wild-legal-home") || !document.querySelector(
        "#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio",
      )) return;
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(schedule, 160);
    };
    const observer = new MutationObserver(schedule);
    enforce();
    document.addEventListener("pointerover", schedule, true);
    document.addEventListener("focusin", schedule, true);
    // H538: CSS reveal animations can finish without a DOM mutation. Recheck
    // the final scale so headings do not retain a mid-animation shadow offset.
    document.addEventListener("animationend", schedule, true);
    document.addEventListener("transitionend", schedule, true);
    document.addEventListener("scroll", scheduleAfterScroll, true);
    window.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      clearTimeout(scrollSettleTimer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      sheet.remove();
      document.removeEventListener("pointerover", schedule, true);
      document.removeEventListener("focusin", schedule, true);
      document.removeEventListener("animationend", schedule, true);
      document.removeEventListener("transitionend", schedule, true);
      document.removeEventListener("scroll", scheduleAfterScroll, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return null;
}
