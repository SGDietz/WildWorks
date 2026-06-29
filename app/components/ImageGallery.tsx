"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Images,
  X,
} from "lucide-react";

const TOTAL_IMAGES = 93;
const BATCH_SIZE = 20;

const phases = [
  { id: "p1", label: "01-20" },
  { id: "p2", label: "21-40" },
  { id: "p3", label: "41-60" },
  { id: "p4", label: "61-80" },
  { id: "p5", label: "81-93" },
] as const;

type PhaseId = (typeof phases)[number]["id"];

type GalleryItem = {
  index: number;
  phase: PhaseId;
  src: string;
};

const phaseForIndex = (index: number): GalleryItem["phase"] => {
  if (index <= 20) return "p1";
  if (index <= 40) return "p2";
  if (index <= 60) return "p3";
  if (index <= 80) return "p4";
  return "p5";
};

const galleryItems: GalleryItem[] = Array.from({ length: TOTAL_IMAGES }, (_, i) => {
  const index = i + 1;
  return {
    index,
    phase: phaseForIndex(index),
    src: `/wildfire/${String(index).padStart(2, "0")}.jpg`,
  };
});

export default function ImageGallery() {
  const [activePhase, setActivePhase] = useState<PhaseId>("p1");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [aspectRatios, setAspectRatios] = useState<Record<string, string>>({});

  const filteredItems = useMemo(
    () => galleryItems.filter((item) => item.phase === activePhase),
    [activePhase]
  );

  const visibleItems = filteredItems.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredItems.length;
  const activePhaseLabel =
    phases.find((phase) => phase.id === activePhase)?.label ?? phases[0].label;
  // Lightbox walks the FULL 93-photo archive (not just the current 20-photo phase),
  // so "Build Step X of 93" + arrow nav stay truthful. (Herm TASK_019)
  const activeLightboxItem =
    lightboxIndex === null ? null : galleryItems[lightboxIndex] ?? null;

  const handlePhaseChange = useCallback((phase: PhaseId) => {
    setActivePhase(phase);
    setVisibleCount(BATCH_SIZE);
    setLightboxIndex(null);
  }, []);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>, src: string) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w && h) {
        setAspectRatios((prev) => ({ ...prev, [src]: `${w} / ${h}` }));
      }
    },
    []
  );

  const openLightbox = useCallback((item: GalleryItem) => {
    const index = galleryItems.findIndex((candidate) => candidate.src === item.src);
    if (index >= 0) setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showPrevious = useCallback(() => {
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current - 1 + galleryItems.length) % galleryItems.length;
    });
  }, []);

  const showNext = useCallback(() => {
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current + 1) % galleryItems.length;
    });
  }, []);

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
    <section id="wildfire-build-journal" className="wildfire-journal discordSection discordSection--2">
      <div className="wildfire-journal-head">
        <p className="wild-kicker">Build Journal</p>
        <h2>
          <span className="ww-c1">Every Stone,</span>{" "}
          <span className="ww-c2">Every Decision,</span>{" "}
          <span className="ww-c3">Every Stage.</span>
        </h2>
        <p>
          Here is a chronological look at Project Wildfire so you can walk through
          the build the way it actually happened. Any questions, please feel free to reach out to me on{" "}
          <a
            href="https://x.com/OfficialSGDietz"
            target="_blank"
            rel="noopener noreferrer"
            className="wildfire-journal-x-link"
          >
            X
          </a>
          .
        </p>
      </div>

      <div className="wildfire-phase-bar" aria-label="Filter build photos by phase">
        {phases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => handlePhaseChange(phase.id)}
            className={activePhase === phase.id ? "is-active" : ""}
          >
            <span>{phase.label}</span>
          </button>
        ))}
      </div>

      <div className="wildfire-gallery-status" aria-live="polite">
        <Images aria-hidden className="h-5 w-5" />
        <span>
          Showing {activePhaseLabel} · {visibleItems.length} of {TOTAL_IMAGES} Field Photos
        </span>
      </div>

      <div className="wildfire-photo-grid">
        {visibleItems.map((item) => (
          <button
            key={item.src}
            type="button"
            className="wildfire-photo-card"
            onClick={() => openLightbox(item)}
            style={{ aspectRatio: aspectRatios[item.src] ?? "16 / 9" }}
          >
            <Image
              src={item.src}
              alt={`Project Wildfire build step ${item.index}`}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              quality={72}
              onLoad={(e) => handleLoad(e, item.src)}
            />
          </button>
        ))}
      </div>

      {canLoadMore ? (
        <div className="wildfire-load-more">
          <button
            type="button"
            className="money-cta"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(current + BATCH_SIZE, filteredItems.length)
              )
            }
          >
            <Images aria-hidden className="h-5 w-5" />
            <span>Load the Next Steps</span>
          </button>
        </div>
      ) : null}

      {activeLightboxItem ? (
        <div
          className="wildfire-lightbox discordSection discordSection--lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Project Wildfire build step ${activeLightboxItem.index}`}
        >
          <div className="wildfire-lightbox-bar">
            <span>
              Build Step {String(activeLightboxItem.index).padStart(2, "0")} of{" "}
              {TOTAL_IMAGES}
            </span>
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
          <div className="wildfire-lightbox-image">
            <Image
              src={activeLightboxItem.src}
              alt={`Project Wildfire build step ${activeLightboxItem.index}`}
              fill
              className="object-contain"
              sizes="100vw"
              quality={86}
            />
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--right"
            onClick={showNext}
            aria-label="Next image"
          >
            <ChevronRight aria-hidden className="h-9 w-9" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
