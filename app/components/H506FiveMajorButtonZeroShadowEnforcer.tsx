"use client";

import { useLayoutEffect } from "react";

/** H506 belt-and-suspenders for five major pages. Grok handoff — Chief installs. */
const PAGE_SELECTOR =
  "#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio";

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
  "svg, img, i, .icon, .wild-iscott-upload__icon, .ww-mail, .ww-phone, .ww-talk-arc-cluster";

function onFiveMajorPage() {
  if (document.querySelector("main.wild-legal-home")) return false;
  return Boolean(document.querySelector(PAGE_SELECTOR));
}

function usesReferenceShadows() {
  return Boolean(document.querySelector(PAGE_SELECTOR));
}

function zeroBoxOnly(el: HTMLElement) {
  el.style.setProperty("box-shadow", "none", "important");
}

function zeroShadow(el: HTMLElement) {
  el.style.setProperty("box-shadow", "none", "important");
  el.style.setProperty("text-shadow", "none", "important");
  el.style.setProperty("filter", "none", "important");
  el.style.setProperty("-webkit-filter", "none", "important");
}

function enforce() {
  if (!onFiveMajorPage()) return;
  const referenceShadows = usesReferenceShadows();

  for (const control of document.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
    if (referenceShadows) {
      // Keep button chrome flat on the five reference pages while leaving
      // text and icon paint to the single shared ZeroShadowEnforcer.
      zeroBoxOnly(control);
      for (const child of control.querySelectorAll<HTMLElement>("*")) {
        zeroBoxOnly(child);
      }
    } else {
      zeroShadow(control);
      for (const child of control.querySelectorAll<HTMLElement>("*")) {
        zeroShadow(child);
      }
      for (const icon of control.querySelectorAll<HTMLElement>(ICON_SELECTOR)) {
        icon.style.setProperty("filter", "none", "important");
        icon.style.setProperty("-webkit-filter", "none", "important");
      }
    }
    for (const twin of control.querySelectorAll<HTMLElement>(".ww-home-btn-icon__shadow")) {
      twin.style.setProperty("display", "none", "important");
      twin.style.setProperty("opacity", "0", "important");
      twin.style.setProperty("visibility", "hidden", "important");
      zeroBoxOnly(twin);
    }
  }
}

export default function H506FiveMajorButtonZeroShadowEnforcer() {
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
