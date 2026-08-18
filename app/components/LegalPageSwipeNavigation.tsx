"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSwipeable, type SwipeEventData } from "react-swipeable";
import { legalNavItems } from "../lib/legalRoutes";
import { useTrackpadHorizontalGesture } from "../lib/useTrackpadHorizontalGesture";

const legalSwipeRoutes = legalNavItems.map((item) => item.href);
const EDGE_GUARD_PX = 24;
const HORIZONTAL_AXIS_RATIO = 1.15;
const MIN_SWIPE_DISTANCE_PX = 44;
const MAX_SWIPE_DISTANCE_PX = 72;
const VIEWPORT_DISTANCE_RATIO = 0.1;

const interactiveIgnoreSelector = [
  "a", "button", "form", "input", "textarea", "select", "option", "label",
  "summary", "video", "audio", "iframe", "canvas", "[contenteditable]", "[role='button']",
  "[data-page-swipe-ignore]", "[data-disable-route-swipe]",
].join(",");

function hasActiveTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function hasTouchInput() {
  return navigator.maxTouchPoints > 0;
}

function shouldIgnoreTarget(target: EventTarget | null) {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  return !element || Boolean(element.closest(interactiveIgnoreSelector));
}

export default function LegalPageSwipeNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const navigationLockRef = useRef(false);

  const commitNavigation = useCallback((direction: -1 | 1) => {
    const livePath = window.location.pathname.replace(/\/$/, "");
    const routeIndex = legalSwipeRoutes.findIndex((route) => route === livePath);
    if (routeIndex < 0 || navigationLockRef.current) return;
    navigationLockRef.current = true;
    const targetIndex = (routeIndex + direction + legalSwipeRoutes.length) % legalSwipeRoutes.length;
    router.push(legalSwipeRoutes[targetIndex]);
  }, [router]);

  const navigate = useCallback((direction: -1 | 1, data: SwipeEventData) => {
    if (!hasTouchInput() || document.querySelector("[role='dialog'][aria-modal='true']") !== null ||
      shouldIgnoreTarget(data.event.target) || hasActiveTextSelection()) return;
    const viewportWidth = Math.max(window.innerWidth, 1);
    const edgeGuard = Math.min(EDGE_GUARD_PX, viewportWidth * 0.06);
    const startX = data.initial[0];
    if (startX <= edgeGuard || startX >= viewportWidth - edgeGuard) return;
    if (data.absX <= data.absY * HORIZONTAL_AXIS_RATIO) return;

    const requiredDistance = Math.max(
      MIN_SWIPE_DISTANCE_PX,
      Math.min(MAX_SWIPE_DISTANCE_PX, viewportWidth * VIEWPORT_DISTANCE_RATIO),
    );
    if (data.absX < requiredDistance) return;

    commitNavigation(direction);
  }, [commitNavigation]);

  const onTrackpadWheel = useTrackpadHorizontalGesture({
    onPrevious: () => commitNavigation(-1),
    onNext: () => commitNavigation(1),
    shouldHandle: (target) => (
      document.querySelector("[role='dialog'][aria-modal='true']") === null &&
      !shouldIgnoreTarget(target) && !hasActiveTextSelection()
    ),
  });

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (data) => navigate(1, data),
    onSwipedRight: (data) => navigate(-1, data),
    delta: { left: 24, right: 24, up: 9999, down: 9999 },
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: true },
  });

  useEffect(() => {
    for (const route of legalSwipeRoutes) router.prefetch(route);
  }, [router]);

  useEffect(() => {
    if (!legalSwipeRoutes.includes(pathname as (typeof legalSwipeRoutes)[number])) return;
    navigationLockRef.current = false;
    swipeHandlers.ref(document.body);
    return () => swipeHandlers.ref(null);
  }, [pathname, swipeHandlers]);

  useEffect(() => {
    if (!legalSwipeRoutes.includes(pathname as (typeof legalSwipeRoutes)[number])) return;
    const surface = document.querySelector<HTMLElement>("main.wild-legal-home");
    if (!surface) return;
    surface.addEventListener("wheel", onTrackpadWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onTrackpadWheel);
  }, [onTrackpadWheel, pathname]);

  return null;
}
