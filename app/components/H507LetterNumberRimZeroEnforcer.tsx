"use client";

import { useLayoutEffect } from "react";

/** H507: zero letter/number rims on five majors. Stops H504 from re-adding 0 1px 0 #000. */
const PAGE_SELECTOR =
  "#top.wild-home, .wild-subpage--wildfire, .wild-subpage--ruins, .wild-subpage--projects, .wild-subpage--bio";

function onFiveMajorPage() {
  if (document.querySelector("main.wild-legal-home")) return false;
  return Boolean(document.querySelector(PAGE_SELECTOR));
}

function enforce() {
  if (!onFiveMajorPage()) return;

  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    const cs = window.getComputedStyle(el);
    if (cs.textShadow && cs.textShadow !== "none") {
      el.style.setProperty("text-shadow", "none", "important");
    }
    if (cs.webkitTextStrokeWidth && cs.webkitTextStrokeWidth !== "0px") {
      el.style.setProperty("-webkit-text-stroke-width", "0", "important");
      el.style.setProperty("-webkit-text-stroke", "0", "important");
    }
  }

  for (const logo of document.querySelectorAll<HTMLElement>(
    ".wild-top-logo, .wild-top-logo-source, .wild-top-logo-landscaping-effect",
  )) {
    logo.style.setProperty("filter", "none", "important");
    logo.style.setProperty("-webkit-filter", "none", "important");
    logo.style.setProperty("text-shadow", "none", "important");
    logo.style.setProperty("box-shadow", "none", "important");
  }
}

export default function H507LetterNumberRimZeroEnforcer() {
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(enforce);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enforce);
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}