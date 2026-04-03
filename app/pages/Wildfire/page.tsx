"use client";

import ImageGallery from "../../components/ImageGallery";
import AspectRatioImage from "../../components/AspectRatioImage";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const viewportReplay = { once: false, amount: 0.2 };
const viewportTight = { once: true, amount: 0.1 };

function AnimatedTopImage() {
  const ref = useRef(null);
  const inView = useInView(ref, viewportTight);
  return (
    <motion.section
      ref={ref}
      className="relative flex w-full items-center justify-center overflow-hidden px-4 sm:px-6"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.div
        className="w-full"
        initial={{ scale: 1.05 }}
        animate={inView ? { scale: 1 } : {}}
        transition={{ duration: 1, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <AspectRatioImage
          src="/50.jpg"
          alt="Project Wildfire - Circular stone mosaic and natural stonework under construction"
          priority
          sizes="100vw"
        />
      </motion.div>
      <div className="absolute inset-0 pointer-events-none" aria-hidden />
    </motion.section>
  );
}

export default function Wildfire() {
  return (
    <div className="mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
      <AnimatedTopImage />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.6 }}
      >
        <ImageGallery />
      </motion.div>

      <motion.section
        className="discordSection discordSection--2 px-4 text-white sm:px-6"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <motion.h1
          className="text-3xl text-center sm:text-6xl"
          variants={fadeInUp}
        >
          Project Wildfire
        </motion.h1>
      </motion.section>

      {/* Project Wildfire description */}
      <motion.section
        className="discordSection discordSection--3 px-4 py-4 text-white sm:px-6 sm:py-6 text-xs"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <motion.div
          className="space-y-2 text-left text-sm leading-[2]"
          style={{ fontFamily: "var(--font-serif), serif" }}
          variants={fadeInUp}
        >
          <p className="text-xs leading-[2]">
            Project Wildfire is a custom crafted, natural stone outdoor fireplace
            installation in Lutherville, Maryland, currently under construction
            by our team at Wildworks.
          </p>
          <p className="text-xs leading-[2]">
            Built entirely by hand—literally one stone at a time—this project blends old-world stone craftsmanship
            with modern scale and design. Our work was inspired by Lew French of{" "}
            <motion.a
              href="https://lewfrenchstone.com"
              className="underline decoration-white/60 underline-offset-2 hover:decoration-white"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              LewFrenchStone.com
            </motion.a>
          </p>
          <p className="text-xs leading-[2]">
            After more than 40 years in construction, these are the builds I
            fondly pursue: the most difficult, the most challenging—custom
            natural stonework projects that demand experience, extreme creativity, and the highest level of problem solving.
          </p>
          <p className="text-xs leading-[2]">
            Project Wildfire is a work in progress that I&apos;m fully{" "}
            <motion.a
              href="https://x.com/OfficialSGDietz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/60 underline-offset-2 hover:decoration-white"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              documenting on X.
            </motion.a>
            . If you&apos;d like to see the behind-the-scenes process of building
            a large-scale custom outdoor fireplace and stack, come over and say hello
          </p>
          <p className="text-xs leading-[2]">
            And always, if you have any questions about any of the photos, or why we built the way we built,
            please feel free to ask me directly on my cell at 1+443-797-2166 or you can DM me on X or Whatsapp:
          </p>
        </motion.div>
      </motion.section>

      <motion.div
        className="flex justify-center gap-4 px-4 pb-8 sm:px-0"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.5 }}
      >
        <motion.a
          href="https://x.com/OfficialSGDietz"
          aria-label="X (Twitter)"
          className="flex h-12 w-12 items-center justify-center text-[#FFFFFF] transition-opacity hover:opacity-80"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.15, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="currentColor"
            aria-hidden
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </motion.a>
        <motion.a
          href="https://api.whatsapp.com/send?phone=14437972166"
          aria-label="WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#25D366] text-white transition-opacity hover:opacity-90"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.15, y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </motion.a>
      </motion.div>
    </div>
  );
}