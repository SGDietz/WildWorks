"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSwipeable, type SwipeEventData } from "react-swipeable";
import { useTrackpadHorizontalGesture } from "./useTrackpadHorizontalGesture";

type LightboxSwipeOptions = { handoff?: "slide" | "crossfade" };

export function useLightboxSwipe(
  onPrevious: () => void,
  onNext: () => void,
  options: LightboxSwipeOptions = {},
) {
  void options;
  const callbacks = useRef({ onPrevious, onNext });
  const gestureHostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    callbacks.current = { onPrevious, onNext };
  }, [onNext, onPrevious]);

  // touchmove fires faster than the display refreshes, and every write of
  // --ww-lightbox-drag-x invalidates style for everything that reads it, on the
  // main thread. Writing several times per frame is wasted work the browser has
  // to finish before it can paint - which is what made the drag feel jumpy.
  // Coalesce to exactly one write per animation frame; the newest position wins.
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ host: HTMLElement; x: number } | null>(null);

  const cancelPendingDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRef.current = null;
  }, []);

  const queueDrag = useCallback((host: HTMLElement, x: number) => {
    pendingDragRef.current = { host, x };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragRef.current;
      pendingDragRef.current = null;
      if (pending) pending.host.style.setProperty("--ww-lightbox-drag-x", `${pending.x}px`);
    });
  }, []);

  const resetDrag = useCallback((host: HTMLElement, animate: boolean) => {
    // Drop any queued frame first, or a stale drag position could land after
    // the reset and snap the image back open.
    cancelPendingDrag();
    host.classList.remove("wild-lightbox-is-dragging");
    if (!animate) host.classList.add("wild-lightbox-no-settle");
    host.style.setProperty("--ww-lightbox-drag-x", "0px");
    if (!animate) {
      window.requestAnimationFrame(() => host.classList.remove("wild-lightbox-no-settle"));
    }
  }, [cancelPendingDrag]);

  useEffect(() => () => {
    cancelPendingDrag();
    if (gestureHostRef.current) resetDrag(gestureHostRef.current, false);
  }, [cancelPendingDrag, resetDrag]);

  const hostFor = (data: SwipeEventData) => data.event.currentTarget as HTMLElement;

  const handlers = useSwipeable({
    onSwiping: (data) => {
      // G 2026-08-28, mobile walk-down, said twice: "it's not swiping from left
      // to right very easily... it's very difficult" and "the left and right
      // from the bottom just does not work."
      //
      // The gate was absX > absY * 1.15 - horizontal had to beat vertical by
      // 15%, i.e. the swipe had to stay within ~41 degrees of dead horizontal.
      // A real thumb swipe arcs, and because .wild-main-shell sets
      // touch-action: pan-y the browser starts scrolling vertically on the same
      // gesture, so an arced swipe both moved the page AND got rejected here.
      // That combination is what made it feel broken rather than merely fussy.
      //
      // 0.8 accepts up to ~51 degrees off horizontal, which covers a natural
      // arc, while still rejecting a genuine vertical scroll (where absY is far
      // larger than absX). Direction check above is unchanged.
      if ((data.dir !== "Left" && data.dir !== "Right") || data.absX <= data.absY * 0.8) return;
      const host = hostFor(data);
      gestureHostRef.current = host;
      const routeSwipeDistance = Number(host.dataset.routeSwipeThrough);
      if (Number.isFinite(routeSwipeDistance) && routeSwipeDistance > 0 && data.absX >= routeSwipeDistance) {
        resetDrag(host, false);
        return;
      }
      host.classList.remove("wild-lightbox-no-settle");
      host.classList.add("wild-lightbox-is-dragging");
      const limit = window.innerWidth * 0.92;
      const x = Math.max(-limit, Math.min(limit, data.deltaX));
      queueDrag(host, x);
    },
    onSwiped: (data) => {
      const host = gestureHostRef.current ?? hostFor(data);
      // Must match the move gate above. This is the COMMIT gate: the one above
      // decides whether the drag tracks, this one decides whether releasing
      // actually changes the picture. Leaving this at 1.15 while the move gate
      // was relaxed would be worse than the original bug - the image would
      // follow the thumb and then snap back, which reads as the site ignoring
      // you rather than as a fussy gesture.
      const horizontal = (data.dir === "Left" || data.dir === "Right") && data.absX > data.absY * 0.8;
      const requiredDistance = Math.max(44, Math.min(68, window.innerWidth * 0.08));
      if (!horizontal || data.absX < requiredDistance) {
        resetDrag(host, true);
        return;
      }

      const routeSwipeDistance = Number(host.dataset.routeSwipeThrough);
      if (Number.isFinite(routeSwipeDistance) && routeSwipeDistance > 0 && data.absX >= routeSwipeDistance) {
        resetDrag(host, false);
        return;
      }

      // The gesture succeeded: drop any queued drag write so a stale offset
      // cannot land after the slide has already started.
      cancelPendingDrag();
      if (data.dir === "Left") callbacks.current.onNext();
      else callbacks.current.onPrevious();
    },
    delta: { left: 4, right: 4, up: 9999, down: 9999 },
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: true },
  });

  const onTrackpadWheel = useTrackpadHorizontalGesture({
    onPrevious: () => callbacks.current.onPrevious(),
    onNext: () => callbacks.current.onNext(),
    shouldHandle: (target) => {
      const element = target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
      return Boolean(element && !element.closest(
        "a,button,form,input,textarea,select,option,label,summary,[contenteditable],[role='button'],[data-page-swipe-ignore],[data-disable-route-swipe]",
      ));
    },
  });

  return { ...handlers, onWheel: onTrackpadWheel };
}
