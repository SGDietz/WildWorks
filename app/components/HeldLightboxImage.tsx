"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from "react";

type LightboxImage = { src: string; alt: string };
export type LightboxDirection = "next" | "previous";
type HeldLightboxImageProps = {
  image: LightboxImage;
  direction?: LightboxDirection;
  priority?: boolean;
};
type Handoff = { image: LightboxImage; direction: LightboxDirection; token: number };

/* A decoded two-layer slide: the painted photo stays fixed while its decoded
   replacement enters from the right. No source swap or empty frame occurs. */
export default function HeldLightboxImage({
  image,
  direction = "next",
  priority = false,
}: HeldLightboxImageProps) {
  const [displayed, setDisplayed] = useState(image);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  const requestedRef = useRef({ image, direction });
  const displayedRef = useRef(image);
  const handoffRef = useRef<Handoff | null>(null);
  const slidingRef = useRef(false);
  const tokenRef = useRef(0);
  const revealTokenRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const incomingImageRef = useRef<HTMLImageElement | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    requestedRef.current = { image, direction };
  }, [direction, image]);

  const clearScheduled = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (revealFrameRef.current !== null) window.cancelAnimationFrame(revealFrameRef.current);
    settleTimerRef.current = null;
    revealFrameRef.current = null;
  }, []);

  useEffect(() => () => {
    clearScheduled();
    handoffRef.current = null;
    tokenRef.current += 1;
  }, [clearScheduled]);

  const beginHandoff = useCallback((next: LightboxImage, nextDirection: LightboxDirection) => {
    clearScheduled();
    const active = { image: next, direction: nextDirection, token: ++tokenRef.current };
    handoffRef.current = active;
    revealTokenRef.current = null;
    slidingRef.current = false;
    setHandoff(active);
    setIsSliding(false);
  }, [clearScheduled]);

  /* A prop change is the state-machine input: loading handoffs may be replaced,
     while an active slide finishes before the latest request is queued. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (slidingRef.current) return;
    if (image.src === displayedRef.current.src) {
      if (handoffRef.current === null) return;
      clearScheduled();
      handoffRef.current = null;
      setHandoff(null);
      setIsSliding(false);
      const host = containerRef.current?.closest<HTMLElement>(".wildfire-lightbox, .wild-image-lightbox, .wild-branded-lightbox");
      host?.classList.remove("wild-lightbox-is-dragging", "wild-lightbox-no-settle");
      host?.style.removeProperty("--ww-lightbox-drag-x");
      return;
    }
    beginHandoff(image, direction);
  }, [beginHandoff, clearScheduled, direction, image]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const commitHandoff = useCallback((active: Handoff) => {
    if (handoffRef.current?.token !== active.token) return;
    clearScheduled();
    displayedRef.current = active.image;
    slidingRef.current = false;
    setDisplayed(active.image);
    setIsSliding(false);
    const host = containerRef.current?.closest<HTMLElement>(".wildfire-lightbox, .wild-image-lightbox, .wild-branded-lightbox");
    host?.classList.remove("wild-lightbox-is-dragging", "wild-lightbox-no-settle");
    host?.style.removeProperty("--ww-lightbox-drag-x");
    const requested = requestedRef.current;
    if (requested.image.src === active.image.src) {
      handoffRef.current = null;
      setHandoff(null);
      return;
    }
    const queued = {
      image: requested.image,
      direction: requested.direction,
      token: ++tokenRef.current,
    };
    handoffRef.current = queued;
    setHandoff(queued);
  }, [clearScheduled]);

  const revealHandoff = useCallback((active: Handoff) => {
    if (handoffRef.current?.token !== active.token) return;
    if (revealTokenRef.current === active.token) return;
    revealTokenRef.current = active.token;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitHandoff(active);
      return;
    }

    if (revealFrameRef.current !== null) window.cancelAnimationFrame(revealFrameRef.current);
    // The incoming layer is already mounted and decoded. One frame lets WebKit
    // paint that offstage position; a second frame visibly parks a released
    // iPad drag before it can settle into the same motion.
    revealFrameRef.current = window.requestAnimationFrame(() => {
      if (handoffRef.current?.token !== active.token) return;
      const host = containerRef.current?.closest<HTMLElement>(".wildfire-lightbox, .wild-image-lightbox, .wild-branded-lightbox");
      host?.classList.remove("wild-lightbox-is-dragging", "wild-lightbox-no-settle");
      slidingRef.current = true;
      setIsSliding(true);
      // transitionend owns the handoff; this is only a browser fallback.
      settleTimerRef.current = window.setTimeout(() => commitHandoff(active), 620);
      revealFrameRef.current = null;
    });
  }, [commitHandoff]);

  const handlePendingLoad = useCallback((active: Handoff, element: HTMLImageElement) => {
    const reveal = () => revealHandoff(active);
    if (typeof element.decode === "function") {
      void element.decode().catch(() => undefined).then(reveal);
    } else {
      reveal();
    }
  }, [revealHandoff]);

  useEffect(() => {
    if (!handoff || !incomingImageRef.current?.complete) return;
    handlePendingLoad(handoff, incomingImageRef.current);
  }, [handoff, handlePendingLoad]);

  const handleIncomingTransitionEnd = useCallback((
    active: Handoff,
    event: TransitionEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (!slidingRef.current) return;
    commitHandoff(active);
  }, [commitHandoff]);

  const activeDirection = handoff?.direction ?? direction;

  return (
    <div
      ref={containerRef}
      className={`wildfire-lightbox-image wildfire-lightbox-image--held direction-${activeDirection}${isSliding ? " is-sliding" : ""}`}
    >
      <div key={`displayed-${displayed.src}`} className="wild-lightbox-image-layer wild-lightbox-image-layer--displayed">
        <Image src={displayed.src} alt={displayed.alt} fill sizes="100vw" className="object-contain" quality={90} priority={priority} />
      </div>
      {handoff ? (
        <div
          key={`incoming-${handoff.token}-${handoff.image.src}`}
          className="wild-lightbox-image-layer wild-lightbox-image-layer--incoming"
          onTransitionEnd={(event) => handleIncomingTransitionEnd(handoff, event)}
        >
          <Image ref={incomingImageRef} src={handoff.image.src} alt={handoff.image.alt} fill sizes="100vw" className="object-contain" quality={90} priority onLoad={(event) => handlePendingLoad(handoff, event.currentTarget)} />
        </div>
      ) : null}
    </div>
  );
}
