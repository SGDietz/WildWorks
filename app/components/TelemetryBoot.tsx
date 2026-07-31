"use client";

import { useEffect } from "react";
import { logTelemetryEvent } from "../lib/clientTelemetry";

export default function TelemetryBoot() {
  useEffect(() => {
    logTelemetryEvent({
      category: "session",
      eventType: "page_open",
      payload: {
        title: document.title,
        href: window.location.href,
        referrer: document.referrer || null,
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
          payload: { href: window.location.href },
        },
        { keepalive: true },
      );
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
