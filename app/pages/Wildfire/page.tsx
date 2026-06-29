"use client";

import { motion } from "framer-motion";
import {
  Camera,
  Phone,
  PlayCircle,
} from "lucide-react";
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

const viewportReplay = { once: false, amount: 0.18 };

const buildPrinciples: { title: string; body: string; href?: string; cta?: string }[] = [
  {
    title: "The Build is the Proof",
    body: "People should not only see the finished thing. They should see the decisions, problems, stone choices, layout changes, and massing that make the finished thing feel inevitable.",
  },
  {
    title: "The Archive is Intentional",
    body: "The gallery is chronological and batched. A serious visitor can keep walking through the work, while a phone does not have to load the whole archive at once.",
  },
  {
    title: "X Carries the Live Trail",
    body: "The site should hold the clean story. X can carry the rough field notes, videos, work-in-progress thoughts, and day-by-day motion of the project.",
    href: "https://x.com/OfficialSGDietz",
    cta: "Follow on X →",
  },
];

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
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">from Breaking</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c2">Ground to the</span>
            <span className="wildfire-hero-headline__line wildfire-hero-headline__line--c3">First Wood Fire.</span>
          </motion.h1>
          <motion.p className="wild-body" variants={fadeInUp}>
            This is not a Before-and-After page. It is a Full Build Record for an
            Outdoor Fireplace, Patio, and Outdoor Lounge with an Upper Viewing Deck.
          </motion.p>
          <motion.div className="wildfire-hero-actions" variants={fadeInUp}>
            <a href="#wildfire-build-journal" className="money-cta money-cta--primary">
              <Camera aria-hidden className="h-5 w-5" />
              <span>Walk the Build</span>
            </a>
            <a
              href="https://x.com/OfficialSGDietz"
              target="_blank"
              rel="noopener noreferrer"
              className="money-cta"
            >
              <PlayCircle aria-hidden className="h-5 w-5" />
              <span>See Videos on X</span>
            </a>
            <a href="tel:+14437972166" className="money-cta">
              <Phone aria-hidden className="h-5 w-5" />
              <span>Call Now</span>
            </a>
          </motion.div>
        </div>
      </motion.section>

      <ImageGallery />

      <motion.section
        className="wildfire-principles discordSection discordSection--3"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-section-heading">
          <motion.h2
            className="wild-section-title wildfire-origin-title"
            variants={fadeInUp}
          >
            <span className="ww-c1">And to Think....</span>
            <span className="ww-c1">It All Started With the Wife</span>
            <span className="ww-c1">Saying to the Husband</span>
            <span className="ww-c2">&quot;Why Don&apos;t You Have Scott</span>
            <span className="ww-c2">Build You a Fireplace.&quot;</span>
            <span className="ww-c3 ww-gap">Then Came the Outdoor Lounge.</span>
            <span className="ww-c3">Then Came the Upper Deck.</span>
            <span className="ww-c3">Then Came the Patio.</span>
          </motion.h2>
        </div>
        <div className="wild-card-grid">
          {buildPrinciples.map((item) =>
            item.href ? (
              <motion.a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.title}: opens X in a new tab`}
                className="wild-card wild-card--link"
                variants={fadeInUp}
              >
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {item.cta ? <span className="wild-card-cta">{item.cta}</span> : null}
              </motion.a>
            ) : (
              <motion.article key={item.title} className="wild-card" variants={fadeInUp}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </motion.article>
            )
          )}
        </div>
      </motion.section>
    </div>
  );
}
