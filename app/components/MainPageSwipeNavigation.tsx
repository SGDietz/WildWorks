"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSwipeable, type SwipeEventData } from "react-swipeable";
import { mainNavigationTabs, normalizeMainNavigationPath } from "../lib/mainNavigation";
import { useTrackpadHorizontalGesture } from "../lib/useTrackpadHorizontalGesture";

const EDGE_GUARD_PX = 24;
const HORIZONTAL_AXIS_RATIO = 1.15;
const MIN_SWIPE_DISTANCE_PX = 44;
const MAX_SWIPE_DISTANCE_PX = 72;
const VIEWPORT_DISTANCE_RATIO = 0.1;

const interactiveIgnoreSelector = [
  "a", "button", "form", "input", "textarea", "select", "option", "label",
  "summary", "video", "audio", "iframe", "canvas", "[contenteditable]",
  "[role='button']",
  "[data-page-swipe-ignore]", "[data-disable-route-swipe]",
].join(",");

const routeSurfaceIgnoreSelector = [
  interactiveIgnoreSelector, "[role='dialog']", "[aria-modal='true']",
  "[class*='lightbox']", "[aria-roledescription='carousel']",
].join(",");

function hasActiveTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function hasTouchInput() {
  return navigator.maxTouchPoints > 0;
}

function isHorizontalContentTrack(start: Element) {
  let current: Element | null = start;
  while (current && current !== document.body) {
    const element = current as HTMLElement;
    const style = window.getComputedStyle(element);
    if (
      (element.scrollWidth > element.clientWidth + 4 && /^(auto|scroll)$/.test(style.overflowX)) ||
      /(^|\s)pan-x(\s|$)/.test(style.touchAction)
    ) return true;
    current = current.parentElement;
  }
  return false;
}

function shouldIgnoreTarget(target: EventTarget | null) {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  if (!element) return true;
  // The routes' large zoomable photos are the natural thumb surface on a
  // phone. A tap still opens the photo; a committed horizontal drag navigates.
  if (element.closest(".wild-zoom-hit-area, .wild-wildfire-photo-button")) {
    return isHorizontalContentTrack(element);
  }
  const routeSwipeThrough = element.closest("[data-route-swipe-through]");
  const blocked = routeSwipeThrough
    ? element.closest(interactiveIgnoreSelector)
    : element.closest(routeSurfaceIgnoreSelector);
  return Boolean(blocked) || isHorizontalContentTrack(element);
}

function routeSwipeThroughDistance(target: EventTarget | null) {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  const host = element?.closest<HTMLElement>("[data-route-swipe-through]");
  if (!host) return null;
  const distance = Number(host.dataset.routeSwipeThrough);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
}

export default function MainPageSwipeNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const navigationLockRef = useRef(false);
  const swipeDestinationPendingRef = useRef(false);
  const entryTimerRef = useRef<number | null>(null);

  const commitNavigation = useCallback((direction: -1 | 1) => {
    const livePath = normalizeMainNavigationPath(window.location.pathname);
    const routeIndex = mainNavigationTabs.findIndex((tab) => tab.href === livePath);
    if (routeIndex < 0 || navigationLockRef.current) return;
    const targetIndex = (routeIndex + direction + mainNavigationTabs.length) % mainNavigationTabs.length;
    const targetRoute = mainNavigationTabs[targetIndex];

    navigationLockRef.current = true;
    swipeDestinationPendingRef.current = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const body = document.body;
    body.style.setProperty("--ww-route-swipe-exit", direction > 0 ? "-10px" : "10px");
    body.style.setProperty("--ww-route-swipe-enter", direction > 0 ? "10px" : "-10px");
    if (!reducedMotion) body.classList.add("wild-route-swipe-leaving");
    router.push(targetRoute.href, { scroll: false });
  }, [router]);

  const navigate = useCallback((direction: -1 | 1, data: SwipeEventData) => {
    const viewportWidth = Math.max(window.innerWidth, 1);
    const sourceEvent = data.event;
    if (
      !hasTouchInput() ||
      document.querySelector("[role='dialog'][aria-modal='true']") !== null ||
      shouldIgnoreTarget(sourceEvent.target) ||
      hasActiveTextSelection()
    ) return;

    const startX = data.initial[0];
    const edgeGuard = Math.min(EDGE_GUARD_PX, viewportWidth * 0.06);
    if (startX <= edgeGuard || startX >= viewportWidth - edgeGuard) return;
    if (data.absX <= data.absY * HORIZONTAL_AXIS_RATIO) return;

    const requiredDistance = routeSwipeThroughDistance(sourceEvent.target) ?? Math.max(
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
    for (const tab of mainNavigationTabs) router.prefetch(tab.href);
  }, [router]);

  useLayoutEffect(() => {
    if (!swipeDestinationPendingRef.current) return;
    swipeDestinationPendingRef.current = false;
    navigationLockRef.current = false;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const body = document.body;
    body.classList.remove("wild-route-swipe-leaving");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    body.classList.add("wild-route-swipe-entering");
    if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
    entryTimerRef.current = window.setTimeout(() => {
      body.classList.remove("wild-route-swipe-entering");
      body.style.removeProperty("--ww-route-swipe-exit");
      body.style.removeProperty("--ww-route-swipe-enter");
      entryTimerRef.current = null;
    }, 140);
  }, [pathname]);

  useEffect(() => {
    const routeIndex = mainNavigationTabs.findIndex(
      (tab) => tab.href === normalizeMainNavigationPath(pathname),
    );
    if (routeIndex < 0) return;

    // Body includes Home's retained logo band as well as the main shell. The
    // previous shell-only mount left a large, visible part of real iPad/phone
    // Home completely outside the route gesture surface.
    swipeHandlers.ref(document.body);
    return () => swipeHandlers.ref(null);
  }, [pathname, swipeHandlers]);

  useEffect(() => {
    const routeIndex = mainNavigationTabs.findIndex(
      (tab) => tab.href === normalizeMainNavigationPath(pathname),
    );
    if (routeIndex < 0) return;
    const surface = document.querySelector<HTMLElement>("main.wild-main-shell");
    if (!surface) return;
    surface.addEventListener("wheel", onTrackpadWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onTrackpadWheel);
  }, [onTrackpadWheel, pathname]);

  useEffect(() => () => {
    if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
    document.body.classList.remove("wild-route-swipe-leaving", "wild-route-swipe-entering");
  }, []);

  return null;
}
