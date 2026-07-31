"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const GALLERY_IMAGES = [
  { src: "/LewFrenchInspiration-2.png", alt: "Lew French inspiration" },
  { src: "/McNulty-Sketch-Cr.jpg", alt: "McNulty sketch" },
  { src: "/McNultyDesign-2.png", alt: "McNulty design" },
  { src: "/20260103_204542-2-high.png", alt: "McNulty design" },
  { src: "/20251222_082817-1-2-high.png", alt: "McNulty design" },

];

const FADE_DURATION_MS = 220;
const DEFAULT_ASPECT = "4 / 3";

export default function InspirationGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<Record<string, string>>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>, src: string) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w && h) setAspectRatios((prev) => ({ ...prev, [src]: `${w} / ${h}` }));
  }, []);

  const goPrev = useCallback(() => {
    if (isFading) return;
    setIsFading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((i) => (i === 0 ? GALLERY_IMAGES.length - 1 : i - 1));
      setIsFading(false);
      timeoutRef.current = null;
    }, FADE_DURATION_MS);
  }, [isFading]);

  const goNext = useCallback(() => {
    if (isFading) return;
    setIsFading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((i) => (i === GALLERY_IMAGES.length - 1 ? 0 : i + 1));
      setIsFading(false);
      timeoutRef.current = null;
    }, FADE_DURATION_MS);
  }, [isFading]);

  const goToIndex = useCallback(
    (index: number) => {
      if (index === currentIndex || isFading) return;
      setIsFading(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex(index);
        setIsFading(false);
        timeoutRef.current = null;
      }, FADE_DURATION_MS);
    },
    [currentIndex, isFading]
  );

  const handleImageAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const mid = rect.width / 2;
      if (x < mid) goPrev();
      else goNext();
    },
    [goPrev, goNext]
  );

  const current = GALLERY_IMAGES[currentIndex];

  return (
    <section className="discordSection discordSection--3 bg-black px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl cursor-pointer">
        {/* Main image viewer - arrows and expand show on hover; container aspect ratio matches current image */}
        <div
          className="wild-inspiration-viewer group relative mx-auto w-full max-w-4xl overflow-hidden"
          style={{ aspectRatio: aspectRatios[current.src] ?? DEFAULT_ASPECT }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={handleImageAreaClick}
        >
          <div
            className="relative h-full w-full transition-opacity duration-200 ease-out"
            style={{ opacity: isFading ? 0 : 1 }}
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 80vw"
              priority
              onLoad={(e) => handleImageLoad(e, current.src)}
            />
          </div>

          {/* Previous button - left, visible on hover */}
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            className={`wild-inspiration-control cursor-pointer absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center transition-opacity duration-200 hover:opacity-90 md:left-4 md:h-14 md:w-14 ${
              isHovering ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 md:h-10 md:w-10" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          {/* Next button - right, visible on hover */}
          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            className={`wild-inspiration-control cursor-pointer absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center transition-opacity duration-200 hover:opacity-90 md:right-4 md:h-14 md:w-14 ${
              isHovering ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 md:h-10 md:w-10" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
            </svg>
          </button>

          {/* Expand button - top right, visible on hover */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand fullscreen"
            className={`wild-inspiration-control cursor-pointer absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center transition-opacity duration-200 ${
              isHovering ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>

        {/* Thumbnail strip - each thumbnail aspect ratio matches its image */}
        <div className="mt-6 flex justify-center gap-1">
          {GALLERY_IMAGES.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => goToIndex(i)}
              className={`wild-inspiration-thumbnail relative shrink-0 overflow-hidden rounded border-2 transition-colors${
                i === currentIndex ? " is-active" : ""
              }`}
              style={{
                width: "4rem",
                aspectRatio: aspectRatios[img.src] ?? "1",
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-contain cursor-pointer"
                onLoad={(e) => handleImageLoad(e, img.src)}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Fullscreen expand overlay */}
      {isExpanded && typeof document !== "undefined" ? createPortal(
        <div
          className="wild-branded-lightbox discordSection discordSection--lightbox fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image fullscreen"
        >
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            aria-label="Close fullscreen"
            className="wild-branded-lightbox-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div
            className="wild-branded-lightbox-stage relative w-full max-h-[90vh] max-w-6xl mx-auto"
            style={{ aspectRatio: aspectRatios[current.src] ?? DEFAULT_ASPECT }}
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              className="object-contain"
              sizes="100vw"
              onClick={() => setIsExpanded(false)}
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
