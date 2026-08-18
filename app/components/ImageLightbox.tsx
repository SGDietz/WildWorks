"use client";

import Image, { type ImageProps } from "next/image";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BrandText from "./BrandText";
import { useLightboxSwipe } from "../lib/useLightboxSwipe";

type ImageLightboxProps = {
  open: boolean;
  src: ImageProps["src"];
  alt: string;
  title?: string;
  className?: string;
  zoomPan?: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
};

export default function ImageLightbox({
  open,
  src,
  alt,
  title,
  className,
  zoomPan = false,
  onClose,
  onPrevious,
  onNext,
}: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, scale: 1, x: 0, y: 0, moved: false });
  const visibleTitle = title?.trim();
  const canSwipe = Boolean(onPrevious && onNext);
  const swipe = useLightboxSwipe(onPrevious ?? onClose, onNext ?? onClose);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious?.();
      if (event.key === "ArrowRight") onNext?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onNext, onPrevious, open]);

  if (!open || typeof document === "undefined") return null;

  const pointDistance = () => {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const beginPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!zoomPan || event.pointerType !== "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      gesture.current = { distance: pointDistance(), scale, x: 0, y: 0, moved: true };
    } else {
      gesture.current = { distance: 0, scale, x: event.clientX, y: event.clientY, moved: false };
    }
  };

  const movePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!zoomPan || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && gesture.current.distance > 0) {
      setScale(Math.max(1, Math.min(3, gesture.current.scale * (pointDistance() / gesture.current.distance))));
      gesture.current.moved = true;
      return;
    }
    if (scale > 1) {
      const dx = event.clientX - gesture.current.x;
      const dy = event.clientY - gesture.current.y;
      if (dx || dy) setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
      gesture.current = { ...gesture.current, x: event.clientX, y: event.clientY, moved: true };
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.distance = 0;
  };

  return createPortal(
    <div
      className={`wild-image-lightbox discordSection discordSection--lightbox${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? alt}
      {...(canSwipe ? swipe : {})}
    >
      <div
        className={`wild-image-lightbox__bar${visibleTitle ? "" : " wild-image-lightbox__bar--close-only"}`}
      >
        {visibleTitle ? (
          <span>
            <BrandText>{visibleTitle}</BrandText>
          </span>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close enlarged image">
          <X aria-hidden className="h-6 w-6" />
        </button>
      </div>
      <button
        type="button"
        className="wild-image-lightbox__stage"
        onClick={() => { if (!zoomPan || scale === 1) onClose(); }}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        aria-label="Close enlarged image"
        style={zoomPan ? { touchAction: "none" } : undefined}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          style={zoomPan ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "center", transition: pointers.current.size ? "none" : "transform 160ms ease" } : undefined}
          sizes="100vw"
          quality={94}
        />
      </button>
    </div>,
    document.body,
  );
}
