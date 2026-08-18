"use client";

import { useEffect } from "react";
import { logTelemetryEvent } from "../lib/clientTelemetry";

export default function TelemetryBoot() {
  useEffect(() => {
    const attribution = Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
        .map((key) => [key, new URLSearchParams(window.location.search).get(key)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    logTelemetryEvent({
      category: "session",
      eventType: "page_open",
      payload: {
        title: document.title,
        path: window.location.pathname,
        attribution,
      },
    });

    const onVisibility = () => {
      logTelemetryEvent(
        {
          category: "app",
          eventType: document.visibilityState === "hidden" ? "page_hidden" : "page_visible",
          payload: { visibilityState: document.visibilityState },
        },
        { keepalive: document.visibilityState === "hidden" },
      );
    };

    const onPageHide = () => {
      logTelemetryEvent(
        {
          category: "app",
          eventType: "page_unload",
          payload: { path: window.location.pathname },
        },
        { keepalive: true },
      );
    };

    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("a,button,[role='button'],input[type='submit']")
        : null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      const link = target instanceof HTMLAnchorElement ? target : null;
      const href = link?.getAttribute("href") ?? null;
      let safeDestination: string | null = null;
      if (href) {
        try {
          const parsed = new URL(href, window.location.origin);
          safeDestination = parsed.protocol === "tel:"
            ? "tel"
            : parsed.protocol === "mailto:"
              ? "mailto"
              : parsed.origin === window.location.origin
                ? parsed.pathname
                : `${parsed.protocol}//${parsed.hostname}`;
        } catch {
          safeDestination = null;
        }
      }
      const label = (
        target.getAttribute("aria-label") ||
        target.dataset.telemetryLabel ||
        target.textContent ||
        `${tag} click`
      ).replace(/\s+/g, " ").trim().slice(0, 120);
      logTelemetryEvent({
        category: "action",
        actionType: "click",
        actionTarget: label || `${tag} click`,
        payload: {
          tag,
          destination: safeDestination,
          elementId: target.id || null,
          role: target.getAttribute("role"),
        },
      }, { keepalive: true });
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}
