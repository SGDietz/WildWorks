"use client";

import { useCallback, useEffect, useRef, type WheelEvent as ReactWheelEvent } from "react";

type TrackpadGestureOptions = {
  onPrevious: () => void;
  onNext: () => void;
  shouldHandle?: (target: EventTarget | null) => boolean;
};

const AXIS_RATIO = 1.15;
const MIN_DISTANCE_PX = 72;
const MAX_DISTANCE_PX = 120;
const GESTURE_GAP_MS = 180;

type NativeOrReactWheelEvent = WheelEvent | ReactWheelEvent<HTMLElement>;

function nativeEvent(event: NativeOrReactWheelEvent) {
  return "nativeEvent" in event ? event.nativeEvent : event;
}

/**
 * Recognizes deliberate two-finger horizontal scrolling without turning mouse
 * movement or ordinary wheel scrolling into navigation. Callers attach the
 * returned handler only to their active ownership surface.
 */
export function useTrackpadHorizontalGesture({
  onPrevious,
  onNext,
  shouldHandle,
}: TrackpadGestureOptions) {
  const callbacksRef = useRef({ onPrevious, onNext, shouldHandle });
  const stateRef = useRef({ distance: 0, lastAt: 0, locked: false });

  useEffect(() => {
    callbacksRef.current = { onPrevious, onNext, shouldHandle };
  }, [onNext, onPrevious, shouldHandle]);

  return useCallback((event: NativeOrReactWheelEvent) => {
    const native = nativeEvent(event);
    const callbacks = callbacksRef.current;
    if (
      native.defaultPrevented ||
      native.deltaMode !== WheelEvent.DOM_DELTA_PIXEL ||
      native.ctrlKey || native.metaKey || native.altKey || native.shiftKey ||
      (callbacks.shouldHandle && !callbacks.shouldHandle(native.target))
    ) return;

    const horizontal = Math.abs(native.deltaX) > Math.abs(native.deltaY) * AXIS_RATIO;
    if (!horizontal || Math.abs(native.deltaX) < 2) return;

    const now = performance.now();
    const state = stateRef.current;
    if (now - state.lastAt > GESTURE_GAP_MS) {
      state.distance = 0;
      state.locked = false;
    }
    state.lastAt = now;
    if (state.locked) return;

    state.distance += native.deltaX;
    const requiredDistance = Math.max(
      MIN_DISTANCE_PX,
      Math.min(MAX_DISTANCE_PX, window.innerWidth * 0.1),
    );
    if (Math.abs(state.distance) < requiredDistance) return;

    // Let normal scrolling remain native until an intentional horizontal
    // gesture has actually committed.
    event.preventDefault();
    state.locked = true;
    state.distance = 0;
    if (native.deltaX > 0) callbacks.onNext();
    else callbacks.onPrevious();
  }, []);
}
