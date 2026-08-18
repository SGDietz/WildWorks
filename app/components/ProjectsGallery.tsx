"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import HeldLightboxImage, { type LightboxDirection } from "./HeldLightboxImage";
import { projectImages, type ProjectImage } from "../lib/projectImages";
import { useLightboxSwipe } from "../lib/useLightboxSwipe";

const projectPageOrder = [5, 0, 8, 3, 1, 10, 6, 4, 13, 2, 11, 7, 9];

const orderedProjectImages: ProjectImage[] = projectPageOrder.map(
  (index) => projectImages[index],
);

export default function ProjectsGallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<LightboxDirection>("next");
  const total = orderedProjectImages.length;
  const active = lightboxIndex === null ? null : orderedProjectImages[lightboxIndex] ?? null;

  const close = useCallback(() => setLightboxIndex(null), []);
  const showPrevious = useCallback(() => {
    setLightboxDirection("previous");
    setLightboxIndex((current) =>
      current === null ? current : (current - 1 + total) % total,
    );
  }, [total]);
  const showNext = useCallback(() => {
    setLightboxDirection("next");
    setLightboxIndex((current) =>
      current === null ? current : (current + 1) % total,
    );
  }, [total]);
  const swipe = useLightboxSwipe(showPrevious, showNext, { handoff: "crossfade" });

  useEffect(() => {
    if (lightboxIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, lightboxIndex, showNext, showPrevious]);

  return (
    <>
      <section className="wild-projects-gallery" aria-label="WildWorks projects" data-route-swipe-through="64">
        {orderedProjectImages.map((image, index) => (
          <figure className="wild-projects-gallery__item" key={image.src}>
            <div className="relative h-full w-full overflow-hidden wild-zoomable-image">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 719px) 100vw, (max-width: 1199px) 50vw, 33vw"
                priority={index < 2}
                className="object-cover object-center"
                quality={86}
              />
              <button
                type="button"
                className="wild-zoom-hit-area"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Enlarge project photo ${index + 1} of ${total}: ${image.alt}`}
              />
            </div>
          </figure>
        ))}
      </section>

      {active && typeof document !== "undefined"
        ? createPortal(
            <div
              className="wildfire-lightbox wild-projects-lightbox discordSection discordSection--lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={active.alt}
              {...swipe}
            >
              <div className="wildfire-lightbox-bar">
                <button type="button" onClick={close} aria-label="Close enlarged project image">
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                className="wildfire-lightbox-nav wildfire-lightbox-nav--left"
                onClick={showPrevious}
                aria-label="Previous project image"
              >
                <ChevronLeft aria-hidden className="h-6 w-6" />
              </button>
              <HeldLightboxImage image={active} direction={lightboxDirection} priority />
              <button
                type="button"
                className="wildfire-lightbox-nav wildfire-lightbox-nav--right"
                onClick={showNext}
                aria-label="Next project image"
              >
                <ChevronRight aria-hidden className="h-6 w-6" />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
