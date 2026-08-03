"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ImageGallery from "../../components/ImageGallery";

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const wildfireHeroImages = [
  {
    src: "/ww-wildfire-night-01-fireplace-patio-lights-off-dark-20260801.png",
    alt: "Project Wildfire outdoor fireplace, Celtic cross patio, and stonework lit at night",
    className: "wild-wildfire-photo--hero",
  },
  {
    src: "/ww-wildfire-night-02-celtic-patio.jpg",
    alt: "Project Wildfire Celtic cross patio and outdoor fireplace from above",
    className: "wild-wildfire-photo--deck",
  },
  {
    src: "/ww-wildfire-night-04-garden-fireplace.jpg",
    alt: "Project Wildfire garden, boulders, rooftop lounge, and fireplace lighting",
    className: "wild-wildfire-photo--garden",
  },
  {
    src: "/ww-wildfire-night-03-deck-fireplace.jpg",
    alt: "Project Wildfire rooftop lounge and outdoor fireplace at night",
    className: "wild-wildfire-photo--patio",
  },
  {
    src: "/ww-wildfire-night-05-celtic-detail.jpg",
    alt: "Project Wildfire Celtic cross patio stone detail",
    className: "wild-wildfire-photo--detail",
  },
];

export default function Wildfire() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeImage = lightboxIndex === null ? null : wildfireHeroImages[lightboxIndex] ?? null;

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPreviousImage = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? current : (current - 1 + wildfireHeroImages.length) % wildfireHeroImages.length,
    );
  }, []);
  const showNextImage = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? current : (current + 1) % wildfireHeroImages.length,
    );
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPreviousImage();
      if (event.key === "ArrowRight") showNextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeLightbox, lightboxIndex, showNextImage, showPreviousImage]);

  return (
    <div className="wild-subpage wild-subpage--wildfire wildfire-page">
      <motion.section
        className="wildfire-hero discordSection discordSection--1"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <div className="wildfire-hero-mosaic wild-wildfire-spread">
          {wildfireHeroImages.map((image, index) => (
            <figure
              key={image.src}
              className={`wild-wildfire-photo ${image.className}`}
            >
              <button
                type="button"
                className="wild-wildfire-photo-button"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Enlarge ${image.alt}`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  priority={index === 0}
                  sizes={
                    image.className === "wild-wildfire-photo--hero"
                      ? "(max-width: 899px) 100vw, 58vw"
                      : "(max-width: 899px) 100vw, 34vw"
                  }
                />
              </button>
            </figure>
          ))}
        </div>
        <div className="wildfire-hero-copy">
          <motion.p className="wild-kicker" variants={fadeInUp}>
            Project Wildfire
          </motion.p>
          <motion.h1 className="wildfire-hero-headline" variants={fadeInUp}>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c1">A Complete Project</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">Build from Breaking Ground</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c3">To the First Wood Fire.</span>
          </motion.h1>
          <motion.p className="wild-body wildfire-hero-summary" variants={fadeInUp}>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c1">
              This is Not a Before-and-After Page. It is a Full Build Record
            </span>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c2">
              for an Outdoor Fireplace, Patio, an Outdoor Lounge, and an Upper Viewing Deck.
            </span>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c3">
              Pics Only, No Descriptions Currently — We’re Working on It!
            </span>
          </motion.p>
        </div>
      </motion.section>

      {activeImage && typeof document !== "undefined" ? createPortal(
        <div
          className="wildfire-lightbox discordSection discordSection--lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.alt}
        >
          <div className="wildfire-lightbox-bar">
            <span>Project Wildfire {lightboxIndex! + 1} of {wildfireHeroImages.length}</span>
            <button type="button" onClick={closeLightbox} aria-label="Close enlarged image">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--left"
            onClick={showPreviousImage}
            aria-label="Previous Project Wildfire image"
          >
            <ChevronLeft aria-hidden className="h-6 w-6" />
          </button>
          <div className="wildfire-lightbox-image">
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              sizes="100vw"
              className="object-contain"
              quality={92}
            />
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--right"
            onClick={showNextImage}
            aria-label="Next Project Wildfire image"
          >
            <ChevronRight aria-hidden className="h-6 w-6" />
          </button>
        </div>,
        document.body,
      ) : null}

      <ImageGallery />
    </div>
  );
}
