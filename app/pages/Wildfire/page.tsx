"use client";

import { motion } from "framer-motion";
import ImageGallery from "../../components/ImageGallery";
import AspectRatioImage from "../../components/AspectRatioImage";

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

export default function Wildfire() {
  return (
    <div className="wild-subpage wild-subpage--wildfire wildfire-page">
      <motion.section
        className="wildfire-hero discordSection discordSection--1"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <div className="wildfire-hero-media" aria-hidden>
          <AspectRatioImage
            src="/ww-wildfire-night-01-fireplace-patio.jpg"
            alt="Finished Project Wildfire natural stone outdoor fireplace at night"
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="wildfire-hero-copy">
          <motion.p className="wild-kicker" variants={fadeInUp}>
            Project Wildfire
          </motion.p>
          <motion.h1 variants={fadeInUp}>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c1">A Complete</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c1">Project Build</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">From Breaking</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">Ground to the</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c3">First Wood Fire.</span>
          </motion.h1>
          <motion.p className="wild-body" variants={fadeInUp}>
            This is Not a Before-and-After Page. It is a Full Build Record for an
            Outdoor Fireplace, Patio, and Outdoor Lounge with an Upper Viewing Deck.
          </motion.p>
        </div>
      </motion.section>

      <ImageGallery />
    </div>
  );
}
