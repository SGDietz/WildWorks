"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const TEXT_NODE = 3;
const LEGAL_ROUTE_CLASS = "wild-legal-page--";

function splitCssList(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function shadowExtent(shadow: string) {
  const withoutColorFunctions = shadow.replace(
    /(?:rgba?|hsla?|color|color-mix)\([^)]*\)/gi,
    "",
  );
  const lengths = Array.from(
    withoutColorFunctions.matchAll(/(-?\d*\.?\d+)px/gi),
    (match) => Math.abs(Number(match[1])),
  );
  return lengths.length ? Math.max(...lengths) : 0;
}

function largestExistingStop(textShadow: string) {
  const stops = splitCssList(textShadow);
  if (stops.length <= 1) return textShadow;

  return stops.reduce((largest, candidate) =>
    shadowExtent(candidate) > shadowExtent(largest) ? candidate : largest,
  );
}

function removeDropShadows(filter: string) {
  let output = "";
  let cursor = 0;

  while (cursor < filter.length) {
    const match = /drop-shadow\s*\(/gi.exec(filter.slice(cursor));
    if (!match) {
      output += filter.slice(cursor);
      break;
    }

    const start = cursor + match.index;
    output += filter.slice(cursor, start);
    let depth = 1;
    let end = start + match[0].length;
    while (end < filter.length && depth > 0) {
      if (filter[end] === "(") depth += 1;
      if (filter[end] === ")") depth -= 1;
      end += 1;
    }
    cursor = end;
  }

  const trimmed = output.trim().replace(/\s+/g, " ");
  return trimmed || "none";
}

function hasOwnVisibleText(element: Element) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

function enforceSingleTextShadow() {
  const legalPage = Boolean(
    document.querySelector(`main[class*="${LEGAL_ROUTE_CLASS}"]`),
  );

  const textElements = Array.from(document.body.querySelectorAll("*")).filter(
    hasOwnVisibleText,
  );

  for (const element of textElements) {
    const styledElement = element as HTMLElement;

    styledElement.style.removeProperty("text-shadow");
    styledElement.style.removeProperty("filter");

    const computed = window.getComputedStyle(element);
    if (computed.display === "none" || computed.visibility === "hidden") continue;

    if (legalPage) {
      styledElement.style.setProperty("text-shadow", "none", "important");
      styledElement.style.setProperty("filter", "none", "important");
      continue;
    }

    if (computed.textShadow !== "none") {
      styledElement.style.setProperty(
        "text-shadow",
        largestExistingStop(computed.textShadow),
        "important",
      );
    }

    if (/drop-shadow\s*\(/i.test(computed.filter)) {
      styledElement.style.setProperty(
        "filter",
        removeDropShadows(computed.filter),
        "important",
      );
    }
  }
}

export default function SingleTextShadowEnforcer() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(enforceSingleTextShadow);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enforceSingleTextShadow);
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(enforceSingleTextShadow);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [pathname]);

  return null;
}
