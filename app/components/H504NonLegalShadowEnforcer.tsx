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
].join(",");

const ICON_SELECTOR = "svg, img, i, .icon, .wild-iscott-upload__icon, .ww-mail, .ww-phone";


function enforce() {
  if (document.querySelector("main.wild-legal-home")) return;
  const referenceShadows = Boolean(document.querySelector(
    "#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio",
  ));

  for (const control of document.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
    // The Home Ruins image hit area includes letterboxing, not a visible button rim.
    const ruinsImageHitArea = control.matches(
      "#top.wild-home .wild-story-card--feature .wild-story-media .wild-zoom-hit-area",
    );
    const homeControl = Boolean(document.querySelector("#top.wild-home")) &&
      !control.closest("header, nav");
    control.style.setProperty("border", ruinsImageHitArea ? "0.5px solid transparent" :
      homeControl ? "0.5px solid rgba(143, 58, 20, 0.45)" : "0.5px solid #8F3A14", "important");
    control.style.setProperty("box-shadow", "none", "important");
    // The approved Home renderer also owns the four named subpages now.
    // Do not race that renderer by clearing its label/icon paint.
    if (!referenceShadows) control.style.setProperty("text-shadow", "none", "important");
    for (const child of control.querySelectorAll<HTMLElement>("*")) {
      child.style.setProperty("box-shadow", "none", "important");
      if (!referenceShadows) child.style.setProperty("text-shadow", "none", "important");
    }
    for (const icon of control.querySelectorAll<HTMLElement>(ICON_SELECTOR)) {
      if (!referenceShadows) icon.style.setProperty("filter", "none", "important");
    }
  }

}

export default function H504NonLegalShadowEnforcer() {
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(enforce);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enforce);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
