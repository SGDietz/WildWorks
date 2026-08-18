"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useLightboxSwipe } from "../lib/useLightboxSwipe";
import { wildfireConstructionImages, wildfireViewerImages } from "../lib/wildfireImages";
import { useNeighborPreload } from "../lib/useNeighborPreload";
import HeldLightboxImage, { type LightboxDirection } from "./HeldLightboxImage";

const PREVIEW_IMAGE_INDICES = [0, 20, 40, 60, 80] as const;
const previewItems = PREVIEW_IMAGE_INDICES.map((index) => wildfireConstructionImages[index]);
const previewLayoutClasses = [
  "wild-wildfire-photo--hero",
  "wild-wildfire-photo--deck",
  "wild-wildfire-photo--garden",
  "wild-wildfire-photo--patio",
  "wild-wildfire-photo--detail",
] as const;

export default function ImageGallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<LightboxDirection>("next");
  useNeighborPreload(wildfireViewerImages, lightboxIndex);
  // The page exposes five intentionally spaced construction entry points. The
  // viewer keeps every construction image, then reveals the five finished
  // fireplace/patio images at the end (one-based positions 94 through 98).
  const activeLightboxItem =
    lightboxIndex === null ? null : wildfireViewerImages[lightboxIndex] ?? null;

  const openLightbox = useCallback((oneBasedIndex: number) => {
    setLightboxIndex(oneBasedIndex - 1);
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showPrevious = useCallback(() => {
    setLightboxDirection("previous");
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current - 1 + wildfireViewerImages.length) % wildfireViewerImages.length;
    });
  }, []);

  const showNext = useCallback(() => {
    setLightboxDirection("next");
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current + 1) % wildfireViewerImages.length;
    });
  }, []);
  const swipe = useLightboxSwipe(showPrevious, showNext, { handoff: "crossfade" });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, lightboxIndex, showNext, showPrevious]);

  return (
    <section id="wildfire-build-journal" className="wildfire-journal wildfire-preview-gallery discordSection discordSection--2">
      <div className="wildfire-preview-mosaic wild-wildfire-spread">
        {previewItems.map((item, index) => (
          <figure
            key={item.src}
            className={`wild-wildfire-photo ${previewLayoutClasses[index]}`}
          >
            <button
              type="button"
              className="wild-wildfire-photo-button"
              onClick={() => openLightbox(item.index)}
              aria-label={`Open the complete Project Wildfire build sequence at ${item.alt}`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover"
                sizes={index === 0 ? "(max-width: 899px) 100vw, 58vw" : "(max-width: 899px) 100vw, 34vw"}
                quality={72}
              />
            </button>
          </figure>
        ))}
      </div>

      {activeLightboxItem && typeof document !== "undefined" ? createPortal(
        <div
          className="wildfire-lightbox wild-projects-lightbox discordSection discordSection--lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxItem.alt}
          {...swipe}
        >
          <div className="wildfire-lightbox-bar">
            <button type="button" onClick={closeLightbox} aria-label="Close image">
              <X aria-hidden className="h-6 w-6" />
            </button>
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--left"
            onClick={showPrevious}
            aria-label="Previous image"
          >
            <ChevronLeft aria-hidden className="h-9 w-9" />
          </button>
          <HeldLightboxImage
            image={{
              src: activeLightboxItem.src,
              alt: activeLightboxItem.alt,
            }}
            direction={lightboxDirection}
            priority
          />
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--right"
            onClick={showNext}
            aria-label="Next image"
          >
            <ChevronRight aria-hidden className="h-9 w-9" />
          </button>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
