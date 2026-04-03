"use client";

import Link from "next/link";
import Script from "next/script";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import AspectRatioImage from "../../components/AspectRatioImage";
import {
  LatestXPostCard,
  LatestXPostCardSkeleton,
  type LatestXPostPayload,
} from "../../components/LatestXPostCard";
import YouTubeVideoBlock from "../../components/YouTubeVideoBlock";

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const viewport = { once: true, amount: 0.2 };
const viewportTight = { once: true, amount: 0.1 };
/** Replay animations every time section re-enters view (used for all non-image content) */
const viewportReplay = { once: false, amount: 0.2 };

const LIVE_AVATAR_EMBED_URL = "https://live-avatar-web-sdk-demo.vercel.app/";

type LatestTweetApiErr = { ok: false; error: string; detail?: string };

/** Fetches latest original post via /api/x/latest (X API v2 + X_BEARER_TOKEN on server). */
function LatestPostFromX() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: LatestXPostPayload }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/x/latest");
        const json = (await res.json()) as LatestXPostPayload | LatestTweetApiErr;
        if (cancelled) return;
        if (!json.ok) {
          const message = json.detail
            ? `${json.error}\n${json.detail}`
            : json.error;
          setState({ status: "error", message });
          return;
        }
        setState({ status: "ok", data: json });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Could not load post." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div aria-live="polite" className="flex flex-col items-center">
        <span className="sr-only">Loading latest post…</span>
        <LatestXPostCardSkeleton />
      </div>
    );
  }

  if (state.status === "error") {
    const showEnvHint =
      /X_BEARER|not configured|503/i.test(state.message) ||
      /Add .*X_BEARER_TOKEN/i.test(state.message);
    return (
      <div className="mx-auto max-w-xl space-y-2 text-sm text-white/75">
        <p className="whitespace-pre-wrap break-words">{state.message}</p>
        {showEnvHint ? (
          <p className="text-white/50">
            Add <code className="rounded bg-white/10 px-1 py-0.5 text-xs">X_BEARER_TOKEN</code>{" "}
            to <code className="rounded bg-white/10 px-1 py-0.5 text-xs">.env.local</code>{" "}
            (see <code className="rounded bg-white/10 px-1 py-0.5 text-xs">.env.example</code>
            ), then restart <code className="rounded bg-white/10 px-1 py-0.5 text-xs">next dev</code>.
          </p>
        ) : null}
      </div>
    );
  }

  return <LatestXPostCard data={state.data} />;
}

function IScottSection({
  variants,
  sessionActive,
  onToggleSession,
}: {
  variants: typeof fadeInUp;
  sessionActive: boolean;
  onToggleSession: () => void;
}) {
  return (
    <div className="flex flex-col items-center w-full max-w-[26rem] mx-auto">
      <motion.div
        className="mx-auto w-full max-w-[26rem] px-4 py-4 sm:py-6 flex justify-center"
        variants={variants}
      >
        <div className="relative aspect-[9/16] w-full max-w-[min(100%,calc(85vh*9/16))] min-h-[180px] overflow-hidden rounded-lg bg-black/40">
          {/* {sessionActive ? ( */}
            <LiveAvatarEmbedInner />
          {/* ) : ( */}
            {/* <Image
              src="/Avatar1.png"
              alt="iScott - Talk to iScott"
              fill
              className="object-cover"
              sizes="22rem"
              priority={false}
              unoptimized
              // onClick={onToggleSession}
            /> */}
          {/* )} */}

            {/* <motion.button
            type="button"
            onClick={onToggleSession}
            className={`absolute bottom-[23.5%] left-1/2 -translate-x-1/2 btn-inset p-3 rounded-lg flex items-center justify-center
               text-lg font-medium whitespace-nowrap cursor-pointer`}
            // variants={variants}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            // style={{ opacity: 1, border: "1px solid white" }}
          >
            {sessionActive ? "Stop Talking" : "Talk to iScott"}
          </motion.button> */}
        </div>
        
      </motion.div>
      
        
    </div>
  );
}

function LiveAvatarEmbedInner() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });
  return (
    <div ref={ref} className="absolute inset-0">
      {inView ? (
        <iframe
          src={LIVE_AVATAR_EMBED_URL}
          title="Live Avatar Web SDK Demo"
          allow="camera; microphone"
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white/70 text-sm">
          Loading…
        </div>
      )}
    </div>
  );
}

function AnimatedImageSection({
  src,
  alt,
  sizes = "100vw",
  delay = 0,
}: {
  src: string;
  alt: string;
  sizes?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, viewportTight);
  return (
    <motion.section
      ref={ref}
      className="relative flex w-full items-center justify-center overflow-hidden px-4 sm:px-6"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.div
        className="w-full"
        initial={{ scale: 1.05 }}
        animate={inView ? { scale: 1 } : {}}
        transition={{ duration: 1, delay: delay + 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <AspectRatioImage
          src={src}
          alt={alt}
          priority={false}
          sizes={sizes}
        />
      </motion.div>
      <div className="absolute inset-0 pointer-events-none" aria-hidden />
    </motion.section>
  );
}

export default function Home() {
  const [iScottSessionActive, setIScottSessionActive] = useState(false);
  return (
    <div className="discordSection discordSection--1 mx-auto lg:max-w-5xl py-4">
      {/* Hero: image with overlaid text - full image visible */}
      <motion.section
        className="relative flex w-full items-center justify-center overflow-hidden px-4 sm:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="w-full"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <AspectRatioImage
            src="/hero-wildworks.jpg"
            alt="WildWorks - Stone staircase and pathway leading to a rustic house with natural landscaping"
            priority
            sizes="100vw"
          />
        </motion.div>
        <div className="absolute inset-0 pointer-events-none" aria-hidden />
      </motion.section>

      {/* Promotional / Contact CTA - black background, centered */}
      <motion.section
        className="discordSection discordSection--1 flex flex-col items-center justify-center gap-3 px-4 py-6 text-center text-white sm:gap-4 sm:px-6 sm:py-8"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <motion.p className="text-xl text-white/95 sm:text-3xl" variants={fadeInUp}>
          On a Quest to Create The World&apos;s Wildest Rock Art
        </motion.p>
        <motion.p className="text-lg text-white/80 -mt-2 sm:text-2xl" variants={fadeInUp}>
          Scott G. Dietz - Owner/Artist
        </motion.p>

        <IScottSection
          variants={fadeInUp}
          sessionActive={iScottSessionActive}
          onToggleSession={() => setIScottSessionActive((prev) => !prev)}
        />

        <motion.h2
          className="text-4xl tracking-wide sm:text-5xl md:text-6xl"
          variants={fadeInUp}
        >
          WildWorks
        </motion.h2>

        <div className="space-y-1 pt-2 sm:pt-4 -mt-5 sm:mt-0">
          <motion.p className="text-lg mt-3 sm:text-xl md:2xl" variants={fadeInUp}>
            Fine Art and Practical Landscaping
          </motion.p>
          <motion.p className="text-xl mt-3 sm:mt-9 sm:text-2xl md:text-3xl" variants={fadeInUp}>
            Want Something Stunningly Wild
          </motion.p>
          <motion.p className="text-2xl mt-3 sm:mt-9 sm:text-3xl md:text-4xl" variants={fadeInUp}>
            In Your Back Yard This Season?
          </motion.p>
        </div>

        <motion.p
          className="pt-4 mt-2 text-4xl sm:pt-6 sm:text-5xl md:text-6xl home-cta-glow"
          variants={fadeInUp}
        >
          Call Now!
        </motion.p>
        <motion.a
          href="tel:+14437972166"
          className="text-2xl font-medium text-white hover:opacity-90 transition-opacity mt-1 inline-block min-h-[44px] sm:mt-8 sm:text-4xl md:text-5xl home-cta-link"
          variants={fadeInUp}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          1+443-797-2166
        </motion.a>
        <motion.a
          href="mailto:Wildworks@pm.me"
          className="text-2xl font-medium text-white hover:opacity-90 transition-opacity -mt-2 inline-block min-h-[44px] sm:mt-8 sm:text-3xl md:text-4xl"
          variants={fadeInUp}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          or Wildworks@pm.me
        </motion.a>

        <motion.p className="text-5xl tracking-widest -mt-2 sm:mt-8 sm:text-6xl" variants={fadeInUp}>
          Scott
        </motion.p>

        <motion.p
          className="text-lg mt-6 sm:mt-8 sm:text-2xl md:text-3xl"
          variants={fadeInUp}
        >
          I WILL TRAVEL ANYWHERE IN THE WORLD TO DESIGN, BUILD, AND PROBLEM SOLVE FOR YOU
        </motion.p>

        <motion.div
          className="flex items-center justify-center gap-4 pt-4 sm:pt-6"
          variants={fadeInUp}
        >
          <motion.a
            href="https://x.com/OfficialSGDietz"
            aria-label="X (Twitter)"
            className="flex h-15 w-15 items-center justify-center text-[#FFFFFF] transition-colors hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="currentColor"
              aria-hidden
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </motion.a>
          <motion.a
            href="https://api.whatsapp.com/send?phone=14437972166"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#25D366] text-white transition-colors hover:opacity-90"
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </motion.a>
        </motion.div>
        <motion.p className="pt-2 text-base text-white/80 sm:text-xl" variants={fadeInUp}>
          DM Me on X or WhatsApp
        </motion.p>
      </motion.section>

      <AnimatedImageSection
        src="/20260121-TreeofLife-Branded-A copy.jpg"
        alt="Tree of Life - A tree with a human face and a tree with a dragon face"
        delay={0}
      />

      {/* Current project banner */}
      <motion.section
        className="discordSection discordSection--2 flex flex-col items-center justify-center px-4 pt-5 text-center text-white sm:gap-4 sm:px-6"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.6 }}
      >
        <p className="text-sm font-normal sm:text-base">
          The Tree of Life Natural Stone Patio with Creeping Perennial
          &quot;Leaves&quot;
        </p>
        <h2 className="text-2xl mt-2 mb-6 sm:text-4xl">
          Our Current Project: Wildfire
        </h2>
      </motion.section>

      <AnimatedImageSection
        src="/50.jpg"
        alt="WildWorks - Stone staircase and pathway leading to a rustic house with natural landscaping"
        sizes="90vw"
      />

      {/* Project Wildfire CTA */}
      <motion.section
        className="discordSection discordSection--3 px-4 pb-8 sm:pb-14 text-center text-white sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.5 }}
      >
        <p className="mx-auto mb-4 mt-5 text-sm leading-relaxed sm:mb-6 sm:text-base">
          Project Wildfire is a Natural Stone Outdoor Fireplace that we&apos;re Building RIGHT NOW
        </p>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/pages/Wildfire"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-2 py-1 font-medium transition-opacity hover:opacity-90 sm:px-6 sm:py-2"
            style={{ fontFamily: "var(--font-geist-sans), sans-serif", backgroundColor: "white", color: "#888", borderRadius: "10px" }}
          >
            Click Here To Check Out Project Wildfire
          </Link>
        </motion.div>
      </motion.section>

      <AnimatedImageSection
        src="/LewFrenchInspiration-2.png"
        alt="WildWorks - Stone staircase and pathway leading to a rustic house with natural landscaping"
      />

      {/* Inspiration: Lew French */}
      <motion.section
        className="discordSection discordSection--4 px-4 pt-2 pb-8 sm:pb-10 text-white sm:px-6 sm:pt-8 sm:pb-14"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="space-y-2 text-left text-sm leading-relaxed sm:space-y-5">
          <motion.h2 className="text-2xl text-center sm:text-4xl" variants={fadeInUp}>
            Inspiration: Lew French
          </motion.h2>
          <motion.p className="text-center mb-4 text-sm sm:text-base" variants={fadeInUp}>
            Project Wildfire Draws Direct Inspiration from the Work of Master Stone Artisan <strong>Lew French</strong>
          </motion.p>
          <motion.div className="flex align-center justify-center" variants={fadeInUp} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/pages/Inspiration"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 py-1 font-medium 
              transition-opacity hover:opacity-90 sm:px-6 sm:py-2 home-cta-btn"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: "1rem", backgroundColor: "white", color: "#888", borderRadius: "10px" }}
            >
              Click Here For Details
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <AnimatedImageSection
        src="/Ruins-Website-20260127-A copy.jpg"
        alt="The Ruins - site-specific stonework in Federal Hill, Baltimore"
      />

      {/* The Ruins CTA */}
      <motion.section
        className="discordSection discordSection--1 px-6 pt-2 sm:pt-8 pb-8 sm:pb-14 text-white text-center"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <motion.h2 className="text-2xl sm:text-4xl mb-2" variants={fadeInUp}>The Ruins</motion.h2>
        <p className="text-md text-white/90 mt-2 sm:mt-4 mb-4">My Client asked me, as we stood looking at their normie back yard, “What do you see here?”</p>
        <motion.div className="inline-block" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/pages/The-ruins"
            className="inline-block rounded-xl bg-white px-8 py-2 text-[#888] font-medium transition-opacity hover:opacity-90"
            style={{ fontFamily: "var(--font-geist-sans), sans-serif", backgroundColor: "white", color: "#888", borderRadius: "10px", padding: "12px 15px" }}
          >
            Click Here to Find Out What I Saw
          </Link>
        </motion.div>
      </motion.section>

      <AnimatedImageSection
        src="/sell.png"
        alt="WildWorks - client property and landscape"
      />

      {/* I sell people's homes. Period. */}
      <motion.section
        className="discordSection discordSection--2 px-4 text-white pb-8 sm:pb-14 sm:-mt-12 sm:px-6 sm:pt-16"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="space-y-4 text-left leading-relaxed sm:space-y-5">
          <motion.h2 className="text-2xl text-center sm:text-3xl mt-3" variants={fadeInUp}>
            My Work Sells People&apos;s Homes. Period.
          </motion.h2>
          <motion.p className="text-center text-sm sm:text-base" variants={fadeInUp}>
            I&apos;ve lost count of how many clients have said the exact same thing to me: &quot;Scott—you sold our house.&quot;
          </motion.p>
          <motion.div className="flex align-center justify-center" variants={fadeInUp} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/pages/I-sell"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl 
                    bg-white px-6 font-medium transition-opacity hover:opacity-90 text-sm sm:px-6 sm:py-2 sm:text-base home-cta-btn"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif", backgroundColor: "white", color: "#888", borderRadius: "10px" }}
            >
              Click Here To See How
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="relative flex md:w-[60%] mx-auto items-center justify-center overflow-hidden px-4 sm:px-6"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={viewport}
        transition={{ duration: 0.7 }}
      >
        <AspectRatioImage
          src="/Fireplace.jpg"
          alt="Stone fireplace with classic ironworks and re-purposed wood from a fallen down barn"
          priority={false}
          sizes="100vw"
        />
        <div className="absolute inset-0 pointer-events-none" aria-hidden />
      </motion.section>

      {/* Fireplace caption */}
      <motion.section
        className="discordSection discordSection--3 px-4 py-6 text-white sm:px-6 sm:py-8"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewportReplay}
        transition={{ duration: 0.5 }}
      >
        <p className="text-center text-white/90">
          Fireplace with Custom Ironworks and Wood Taken from a Colonial Era Fallen Down Barn
        </p>
      </motion.section>

      {/* Video section - YouTube embed with Copy link & Watch on YouTube */}
      {/* <YouTubeVideoBlock /> */}

      <motion.section
        className="px-4 pb-8 sm:px-6 sm:pb-10"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <video
            loop
            muted
            playsInline
            controls
            className="w-full h-auto max-h-[75vh] object-contain"
          >
            <source src="/WildWorksVideo.mp4" type="video/mp4" />
          </video>
        </div>
      </motion.section>


      {/* Latest X post — text/media from X API v2 (server) */}
      <motion.section
        className="discordSection discordSection--4 px-4 pb-8 text-center text-white sm:px-6"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.6 }}
      >
        <LatestPostFromX />
      </motion.section>

      {/* <motion.section
        className="px-4 pb-8 text-center text-white sm:px-6"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto flex max-w-2xl justify-center [&_.twitter-tweet]:mx-auto">
          <blockquote
            className="twitter-tweet"
            dangerouslySetInnerHTML={{
              __html: `<p lang="en" dir="ltr">Most People Never See Stonework Like This.<br><br>Drone footage of a 
              handcrafted natural stone terrace, super steps, a seat wall with boulder bookends, and boulder outcroppings.<br><br>
              When the lush foliage grows in and around this landscape, it's built to look like it's been part of the… 
              <a href="https://t.co/NPQRR59Eyj">pic.twitter.com/NPQRR59Eyj</a></p>&mdash; WildWorks (@OfficialSGDietz) 
              <a href="https://twitter.com/OfficialSGDietz/status/2030296263833313522?ref_src=twsrc%5Etfw">March 7, 2026</a>`,
            }}
          />
        </div>
        <Script
          src="https://platform.twitter.com/widgets.js"
          strategy="lazyOnload"
        />
      </motion.section> */}

      {/* Exquisite Art / WildWorks CTA */}
      <motion.section
        className="discordSection discordSection--1 px-4 py-1 sm:py-8 text-center text-white sm:px-6"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="space-y-1 sm:space-y-3 sm:space-y-4">
          <motion.p className="text-2xl sm:text-3xl" variants={fadeInUp}>Exquisite Art</motion.p>
          <motion.p className="text-2xl sm:text-3xl" variants={fadeInUp}>
            Unequaled Practicality & Craftsmanship
          </motion.p>
          <motion.h2 className="py-4 text-5xl sm:py-8 sm:text-6xl" variants={fadeInUp}>
            WildWorks
          </motion.h2>
          <motion.p className="text-2xl text-white/95 sm:text-3xl" variants={fadeInUp}>
            A Complete Design/Build Global Co.
          </motion.p>
          <motion.a
            href="tel:+14437972166"
            className="no-underline inline-block min-h-[44px] py-4 text-3xl decoration-white/50 underline-offset-4 transition-colors hover:decoration-white sm:text-4xl home-cta-link"
            variants={fadeInUp}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            1+443-797-2166
          </motion.a>
          <motion.p className="text-3xl sm:text-4xl" variants={fadeInUp}>Call or Text Today!</motion.p>
          <motion.p className="pt-4 sm:pt-6 text-5xl sm:text-6xl" variants={fadeInUp}>Scott</motion.p>

          <motion.div
            className="mt-6 sm:mt-10 flex justify-center items-center gap-4 sm:mt-14"
            variants={fadeInUp}
          >
            <motion.a
              href="https://x.com/OfficialSGDietz"
              aria-label="X (Twitter)"
              className="flex h-15 w-15 items-center justify-center text-[#FFFFFF] transition-colors hover:opacity-80"
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
          <motion.p className="pt-4 text-base text-white/90 sm:text-xl" variants={fadeInUp}>
            DM Me directly on X or WhatsApp
          </motion.p>
        </div>
      </motion.section>
    </div>
  );
}
