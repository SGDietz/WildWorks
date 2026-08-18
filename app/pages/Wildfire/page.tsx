"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ImageGallery from "../../components/ImageGallery";
import HeldLightboxImage, { type LightboxDirection } from "../../components/HeldLightboxImage";
import LargeIScottCta from "../../components/LargeIScottCta";
import PhoneNumberLine from "../../components/PhoneNumberLine";
import { useLightboxSwipe } from "../../lib/useLightboxSwipe";
import { wildfireFinishedImages } from "../../lib/wildfireImages";

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const wildfireHeroImageIndex = 2;
const wildfireHeroImage = wildfireFinishedImages[wildfireHeroImageIndex];

export default function Wildfire() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<LightboxDirection>("next");
  const activeImage = lightboxIndex === null ? null : wildfireFinishedImages[lightboxIndex] ?? null;

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPreviousImage = useCallback(() => {
    setLightboxDirection("previous");
    setLightboxIndex((current) =>
      current === null ? current : (current - 1 + wildfireFinishedImages.length) % wildfireFinishedImages.length,
    );
  }, []);
  const showNextImage = useCallback(() => {
    setLightboxDirection("next");
    setLightboxIndex((current) =>
      current === null ? current : (current + 1) % wildfireFinishedImages.length,
    );
  }, []);
  const swipe = useLightboxSwipe(showPreviousImage, showNextImage, { handoff: "crossfade" });

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
      <style>{`
        html:has(.wild-subpage--wildfire) {
          /* Match the approved rich copper page field without changing any
             Project Wildfire cards, galleries, buttons, or content surfaces. */
          --ww-wildfire-page-background:
            radial-gradient(circle at 16% 9rem, rgba(255, 190, 94, 0.16), transparent 32rem),
            radial-gradient(circle at 84% 50rem, rgba(255, 181, 82, 0.12), transparent 36rem),
            radial-gradient(
              ellipse 180% 122% at 50% 34%,
              color-mix(in srgb, var(--ww-primary) 92%, white) 0%,
              color-mix(in srgb, var(--ww-primary) 96%, white) 42%,
              color-mix(in srgb, var(--ww-primary) 96%, black) 74%,
              color-mix(in srgb, var(--ww-primary) 92%, black) 100%
            ),
            var(--ww-primary) !important;
          background: var(--ww-wildfire-page-background) !important;
          background-attachment: fixed !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
        }

        body:has(.wild-subpage--wildfire) {
          background: transparent !important;
        }

        body:has(.wild-subpage--wildfire) .wild-site-backdrop {
          background: var(--ww-wildfire-page-background) !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
        }
      `}</style>
      <motion.section
        className="wildfire-hero discordSection discordSection--1"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <motion.p className="wildfire-page-heading" variants={fadeInUp}>
          <span className="wildfire-page-heading__project"><span className="wildfire-hero-kicker__cap">P</span>roject</span>{" "}
          <span className="wildfire-page-heading__wildfire"><span className="wildfire-hero-kicker__cap">W</span>ildfire</span>
        </motion.p>
        <div className="wildfire-hero-single">
          <figure className="wild-wildfire-photo wild-wildfire-photo--single-hero">
            <button
              type="button"
              className="wild-wildfire-photo-button"
              onClick={() => setLightboxIndex(wildfireHeroImageIndex)}
              aria-label={`Enlarge ${wildfireHeroImage.alt}`}
            >
              <Image
                src={wildfireHeroImage.src}
                alt={wildfireHeroImage.alt}
                fill
                priority
                sizes="(max-width: 899px) 100vw, 92rem"
              />
            </button>
          </figure>
        </div>
        <div className="wildfire-hero-copy">
          <motion.h1 className="wildfire-hero-headline" variants={fadeInUp}>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c1">A Complete Project Build</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">From Breaking Ground</span>
            <span id="ww-wildfire-first-fire" className="wildfire-hero-headline__line wildfire-hero-headline__line--c3">To The First Wood Fire.</span>
          </motion.h1>
          <motion.p className="wild-body wildfire-hero-summary" variants={fadeInUp}>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c1">
              This Is Not a Before-and-After Page. It Is
            </span>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c2">
              a Full Build Record for an Outdoor Fireplace,
            </span>
            <span className="wildfire-hero-summary__line wildfire-hero-summary__line--c3">
              Patio, Outdoor Lounge, and an Upper Viewing Deck.
            </span>
          </motion.p>
        </div>
      </motion.section>

      {activeImage && typeof document !== "undefined" ? createPortal(
        <div
          className="wildfire-lightbox wild-projects-lightbox discordSection discordSection--lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.alt}
          {...swipe}
        >
          <div className="wildfire-lightbox-bar">
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
          <HeldLightboxImage image={activeImage} direction={lightboxDirection} priority />
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
      <div className="wildfire-gallery-home-contact">
        <PhoneNumberLine
          className="wild-phone-number-line--home-footer"
          showCallToday={false}
        />
        <LargeIScottCta href="/pages/Home?wake-iscott=1#talk-to-iscott" />
      </div>
    </div>
  );
}
