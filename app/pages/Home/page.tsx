"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useInView, type Variants } from "framer-motion";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Flame,
  Globe2,
  Hammer,
  Home as HomeIcon,
  MessageCircle,
  Phone,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";
import ImageLightbox from "../../components/ImageLightbox";

const softEase: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const softTransition = { duration: 0.72, ease: softEase };

const fadeInUp: Variants = {
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0, transition: softTransition },
};

const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -34, y: 8 },
  animate: { opacity: 1, x: 0, y: 0, transition: softTransition },
};

const fadeInRight: Variants = {
  initial: { opacity: 0, x: 34, y: 8 },
  animate: { opacity: 1, x: 0, y: 0, transition: softTransition },
};

const softScaleIn: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.975 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.82, ease: softEase } },
};

const imageReveal: Variants = {
  initial: { opacity: 0, x: -28, y: 12 },
  animate: { opacity: 1, x: 0, y: 0, transition: { duration: 0.82, ease: softEase } },
};

const imageRevealRight: Variants = {
  initial: { opacity: 0, x: 28, y: 12 },
  animate: { opacity: 1, x: 0, y: 0, transition: { duration: 0.82, ease: softEase } },
};

const cardDrift: Variants = {
  initial: (custom = 0) => ({
    opacity: 0,
    x: [-18, 18, -10, 10][Number(custom) % 4],
    y: [16, 10, 22, 8][Number(custom) % 4],
  }),
  animate: (custom = 0) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.62,
      delay: Number(custom) * 0.035,
      ease: softEase,
    },
  }),
};

const smallDrift: Variants = {
  initial: (custom = 0) => ({
    opacity: 0,
    x: Number(custom) % 2 === 0 ? -12 : 12,
    y: 8,
  }),
  animate: (custom = 0) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.5,
      delay: Number(custom) * 0.025,
      ease: softEase,
    },
  }),
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

const slowStagger = {
  animate: {
    transition: { staggerChildren: 0.11, delayChildren: 0.12 },
  },
};

const viewportTight = { once: true, amount: 0.1 };
const viewportReplay = { once: false, amount: 0.18 };

const LIVE_AVATAR_EMBED_URL = "/pages/avatar-iscott";
const SHOW_PROJECT_WILDFIRE_FLAMES = false;

const noWhiteTextStyle = {
  color: "rgba(211, 151, 82, 0.9)",
  WebkitTextFillColor: "rgba(211, 151, 82, 0.9)",
  backgroundImage: "none",
};

const noWhiteKickerStyle = {
  color: "rgba(181, 111, 52, 0.94)",
  WebkitTextFillColor: "rgba(181, 111, 52, 0.94)",
  backgroundImage: "none",
};

const noWhiteBlendTextStyle = {
  color: "transparent",
  WebkitTextFillColor: "transparent",
  backgroundImage:
    "linear-gradient(180deg, #e8b66d 0%, #b56f34 58%, #7a3d18 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  backgroundSize: "100% 1.62em",
  backgroundRepeat: "repeat-y",
  backgroundPosition: "0 0",
};

const showWildWorksIdentitySection = false;
const showProcessSection = false;
const showWildWorksDifferentSection = false;
const showWildWorksAiSection = false;
const showWildfireInspirationSection = false;

const iScottSteps = [
  {
    title: "Describe areas you would like beautified and/or problem areas you may have",
  },
  {
    title: "Talk through location, and your timing preferences/needs",
  },
  {
    title: "Bounce ideas off iScott, and he will bounce ideas right back to you",
  },
  {
    title: "If appropriate, iScott will set up either an in-person or Zoom meeting with the real Scott",
  },
];

const wildWorksModes = [
  {
    number: "1",
    title: "The Real Human Scott",
    titleLines: ["The Real", "Human Scott"],
    body: "Scott can be on the ground, read the land with his own eyes, design the work, and build the kind of stone, terrain, water, fire, and garden art that makes a property feel alive. For the right project, Scott can go anywhere in the world.",
    points: [
      "In-person site reads and design/build work",
      "Travel anywhere for the right WildWorks project",
      "Real stone, terrain, planting, water, fire, and finish judgment",
    ],
    image: "/ww-art-wilds.jpeg",
    alt: "Scott standing beside a WildWorks natural stone landscape",
    icon: UserRound,
  },
  {
    number: "2",
    title: "WildWorks.Ai",
    titleLines: ["WildWorks.Ai"],
    body: "The same human Scott can start remotely. Photos, video, Zoom, property goals, contractor bids, and problem areas can be organized by Ai agents so Scott can diagnose, iterate designs fast, direct, and oversee from wherever he is to wherever you are.",
    points: [
      "Rapid Ai assisted design iterations for people anywhere",
      "Remote diagnosis through photos, video, and Zoom",
      "Use your contractor, let Scott help find one, or bring Scott in",
      "Ai agents learning how Scott reads and solves real-world property work",
    ],
    image: "/Final-GabbyTravis.jpg",
    alt: "Scott sitting in a WildWorks boulder garden",
    icon: Globe2,
  },
];

const aiCapabilities = [
  {
    title: "Beta Intake",
    titleParts: ["Beta", "Intake"],
    body: "Start with iScott. Discuss your needs, location, goals, travel considerations, timing, budget range, and how you prefer to be reached. This is the first doorway to world-class design help from WildWorks.Ai.",
    icon: Camera,
  },
  {
    title: "Human Handoff",
    titleParts: ["Human", "Handoff"],
    body: "iScott organizes the details and passes them off to the real Scott, so access to beautiful design still runs through human taste, judgement, and experience while WildWorks.Ai is in beta and building out the system.",
    icon: Wrench,
  },
  {
    title: "Design Iteration",
    titleParts: ["Design", "Iteration"],
    body: "Scott uses 40+ years of taste, field judgement, engineering sense, and Ai assisted design to turn rough photos and goals into tasteful, practical options.",
    icon: Sparkles,
  },
];

const services = [
  {
    title: "Wild Design",
    titleLines: ["Wild Design"],
    body: [
      "If you want designs at the limits of human imagination, Scott is looking for you. People that want the world's wildest things, you are the ideal WildWorks client, wherever you are in the world.",
      "With 40 years of design experience, and make no mistake, building the designs hands on with his guys, Scott keeps reaching new heights, and your project could be next among the world's wildest builds.",
    ],
    icon: Sparkles,
  },
  {
    title: "Building / Engineering",
    titleLines: ["Building / Engineering"],
    body: [
      "Craftsmanship in any material — stone, wood, water, steel, or living plants — inside or out, has to pass one test: Time.",
      "Anything can look good on day one. The real proof shows up years later, after the weather, the use, and the wear — when the shortcuts other people take have already failed.",
      "When Scott revisits a project years later, he can see how cleanly it settled in — no corners cut, nothing to hide, no trip hazards, no blemishes. Work that aged like it was always meant to be there.",
      "That is the standard on every build: engineer it right, build it to last, and let Time be the judge.",
    ],
    icon: Hammer,
  },
  {
    title: "Ballparks",
    titleLines: ["Ballparks"],
    body: [
      "Before any design work begins, WildWorks gives you honest ballpark numbers, so you can decide whether to move forward knowing roughly what it will cost. Agree on the scope, and the design phase starts.",
    ],
    icon: DollarSign,
  },
  {
    title: "Problem Solving",
    titleLines: ["Problem Solving"],
    body: [
      "Some home and garden problems get lived with for years, even decades — water, grading, access, safety, and the failed fixes other contractors could never make stick.",
      "Scott runs toward the problems most contractors back away from, so bring him the hard ones. And if he can't crack it himself, he has a network of trusted contractors and friends he can call on.",
    ],
    icon: Wrench,
  },
  {
    title: "Resale Driven Transformations",
    titleLines: ["Resale Driven Transformations"],
    body: [
      "When you're selling, practicality wins. Scott looks at everything through the lens of strict minimalism — the things that, in his honest opinion, simply have to be fixed — and never pushes more than you need, always at the fairest price.",
      "It might sound self-serving coming from him, but Scott means it: if you're upgrading to sell, don't wait until you're about to list. Do the work now, and enjoy it yourself first.",
    ],
    icon: HomeIcon,
  },
  {
    title: "How much can WildWorks do?",
    titleLines: ["How much can WildWorks do?"],
    body: [
      "WildWorks can be a true one-stop shop, or a design and diagnosis layer around the people you already have: property scouting, house and site placement, clearing, whole-property design direction, contractor guidance, design/build from the ground up, obstacle solving, and work in stone, wood, pavers, segmental block, water, fire, and planting.",
    ],
    icon: Globe2,
  },
  {
    title: "Will WildWorks Travel?",
    titleLines: ["Will WildWorks Travel?"],
    body: [
      "Yes, WildWorks will travel anywhere for you. Many projects can also start with a remote design or diagnosis conversation through photos, video, and/or Zoom. Start with iScott. Give him the location, scope, timing, photos, and every detail you can, and he will hand it off to the real Scott, who will pick it up from there.",
    ],
    icon: CheckCircle2,
  },
];

const signatureWork = [
  {
    title: "The Ruins",
    titleLines: ["The", "Ruins"],
    body: [
      "Want the Coolest Party Zone or Outdoor Kitchen You Have Ever Seen in Your Own Back Yard?",
      "If You've Got a Space, We can Create a Purpose-Built Area to Look Like the Original Farmhouse that the Neighborhood Was Built Around, or a Long Forgotten Gristmill — that is Now Party Central.",
      `Wherever you are, if you want a space that feels unforgettable — something people will talk about for generations — call me.
+1(443) 797-2166
or Talk to iScott
He'll reach out to me, and I will get back to you.`,
    ],
    image: "/ww-art-ruins.jpeg",
    alt: "The Ruins stonework garden and reflecting pool by WildWorks",
    variant: "feature",
    href: "/pages/The-ruins",
    cta: "Explore The Ruins",
  },
  {
    title: "My Work Sells People's Homes. Period.",
    titleLines: ["My Work", "Sells People's", "Homes. Period."],
    body: 'Not sure how many times I have had clients say to me, "Scott, you sold our home."',
    image: "/GabbyTravis-Final-20260622.jpg",
    alt: "Scott sitting in a WildWorks boulder garden",
    variant: "featureSell",
    href: "/pages/I-sell",
    cta: "See How",
  },
];

const wildfireNightImages = [
  {
    src: "/ww-wildfire-night-01-fireplace-patio.jpg",
    alt: "Project Wildfire outdoor fireplace, Celtic cross patio, and stonework lit at night",
    className: "wild-wildfire-photo--hero",
  },
  {
    src: "/ww-wildfire-night-03-deck-fireplace.jpg",
    alt: "Project Wildfire rooftop lounge and outdoor fireplace at night",
    className: "wild-wildfire-photo--deck",
  },
  {
    src: "/ww-wildfire-night-04-garden-fireplace.jpg",
    alt: "Project Wildfire garden, boulders, rooftop lounge, and fireplace lighting",
    className: "wild-wildfire-photo--garden",
  },
  {
    src: "/ww-wildfire-night-02-celtic-patio.jpg",
    alt: "Project Wildfire Celtic cross patio and outdoor fireplace from above",
    className: "wild-wildfire-photo--patio",
  },
  {
    src: "/ww-wildfire-night-05-celtic-detail.jpg",
    alt: "Project Wildfire Celtic cross patio stone detail",
    className: "wild-wildfire-photo--detail",
  },
];

const wildfireInspirationImages = [
  {
    src: "/ww-wildfire-inspiration-loggia.png",
    alt: "Ai inspiration image of an outdoor lounge and loggia with a fireplace",
    className: "wild-wildfire-inspiration-card--loggia",
    width: 655,
    height: 652,
  },
  {
    src: "/ww-wildfire-inspiration-patio.jpg",
    alt: "Ai inspiration image of a patterned stone patio with planting",
    className: "wild-wildfire-inspiration-card--patio",
    width: 474,
    height: 711,
  },
];

const wildfireLightboxImages = [...wildfireNightImages, ...wildfireInspirationImages];

const processSteps = [
  {
    title: "Background",
    titleLines: ["Background"],
    body: "iScott collects the project idea, location, budget range, timeline, photos, and whether you need design, diagnosis, contractor support, or a full WildWorks build.",
  },
  {
    title: "Set Appointment",
    titleLines: ["Set Appointment"],
    body: "Scott follows up for the right next conversation: a local site visit when location allows, or a Zoom call when the project is outside his local range.",
  },
  {
    title: "Meeting",
    titleLines: ["Meeting"],
    body: "You meet with Scott, either on-site or over Zoom, and discuss your needs. Scott loves to bounce ideas back and forth. Often in this meeting, he can give you ballparks for the work you need, or get them to you soon after.",
  },
  {
    title: "Designs and Estimates",
    titleLines: ["Designs and", "Estimates"],
    body: "The strongest direction becomes rapid design iteration when a design is appropriate. Projects that are mainly problem solving may not need a design; they may need the right fix, scope, and estimate.",
  },
  {
    title: "Buildout",
    titleLines: ["Buildout"],
    body: "Whether it is a fix or an installation, once the direction is clear, the work can move through your contractor, a contractor Scott helps source, or Scott and WildWorks directly when the fit is right.",
  },
];

const aiWebsiteCapabilities = [
  {
    title: "Avatar Intake",
    titleLines: ["Avatar Intake"],
    body: "Let the Ai collect context, photos, set appointments, and answer any and all questions automatically.",
    icon: MessageCircle,
  },
  {
    title: "Ai-Native Build",
    titleLines: ["Ai-Native Build"],
    body: "Design, copy, media, automations, and lead flow built in and around your company brand.",
    icon: Sparkles,
  },
  {
    title: "Human Voice",
    titleLines: ["Human Voice"],
    body: "Though your site will be Ai-driven, it will feel like the real people that run the company, nothing generic.",
    icon: HomeIcon,
  },
];

function IScottSection({
  variants,
  wakeKey,
}: {
  variants: Variants;
  wakeKey: number;
}) {
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center">
      <motion.div
        className="mx-auto flex w-full justify-center px-2 py-3 sm:px-4"
        variants={variants}
      >
        <div className="wild-live-avatar-frame relative aspect-[9/16] w-full max-w-[20rem] min-h-[300px] overflow-hidden rounded-lg bg-black/40">
          <LiveAvatarEmbedInner wakeKey={wakeKey} />
        </div>
      </motion.div>
    </div>
  );
}

function LiveAvatarEmbedInner({ wakeKey }: { wakeKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const shouldMountAvatar = inView || wakeKey > 0;
  const avatarEmbedSrc =
    wakeKey > 0 ? `${LIVE_AVATAR_EMBED_URL}?wake=${wakeKey}` : LIVE_AVATAR_EMBED_URL;

  return (
    <div ref={ref} className="absolute inset-0">
      {shouldMountAvatar ? (
        <iframe
          key={avatarEmbedSrc}
          src={avatarEmbedSrc}
          title="Live Avatar Web SDK Demo"
          allow="camera; microphone"
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-[rgba(246,211,154,0.78)]">
          Loading...
        </div>
      )}
    </div>
  );
}

function lineColorClass(index: number, total: number) {
  if (total === 1) return "wild-line-title__line--one";
  if (total === 2) return index === 0 ? "wild-line-title__line--one" : "wild-line-title__line--two";
  if (total === 3) {
    return [
      "wild-line-title__line--one",
      "wild-line-title__line--two",
      "wild-line-title__line--three",
    ][index];
  }
  if (index < 2) return "wild-line-title__line--one";
  if (index === 2) return "wild-line-title__line--two";
  return "wild-line-title__line--three";
}

function LineTitle({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span
          key={`${line}-${index}`}
          className={`wild-line-title__line ${lineColorClass(index, lines.length)}`}
        >
          <BrandText>{line}</BrandText>
        </span>
      ))}
    </>
  );
}

const storyInlineActionStyle: CSSProperties = {
  color: "#f7d9a5",
  WebkitTextFillColor: "#f7d9a5",
  fontWeight: 850,
  textDecoration: "none",
};

function renderSignatureStoryLine(
  line: string,
  onIScottClick: (event: MouseEvent<HTMLAnchorElement>) => void,
) {
  if (line.trim() === "+1(443) 797-2166") {
    return (
      <a
        className="wild-story-contact-link wild-story-contact-link--phone"
        href="tel:+14437972166"
        aria-label="Call Scott directly at +1(443) 797-2166"
        style={storyInlineActionStyle}
      >
        +1(443) 797-2166
      </a>
    );
  }

  const iScottText = "Talk to iScott";
  const iScottIndex = line.indexOf(iScottText);

  if (iScottIndex === -1) {
    return <BrandText>{line}</BrandText>;
  }

  return (
    <>
      <BrandText>{line.slice(0, iScottIndex)}</BrandText>
      <a
        className="wild-story-contact-link wild-story-contact-link--iscott"
        href="#talk-to-iscott"
        onClick={onIScottClick}
        aria-label="Talk to iScott"
        style={storyInlineActionStyle}
      >
        {iScottText}
      </a>
      <BrandText>{line.slice(iScottIndex + iScottText.length)}</BrandText>
    </>
  );
}

function signatureStoryLineClassName(line: string) {
  const normalizedLine = line.trim();

  if (normalizedLine === "+1(443) 797-2166") {
    return "wild-story-contact-line wild-story-contact-line--phone";
  }

  if (normalizedLine === "or Talk to iScott") {
    return "wild-story-contact-line wild-story-contact-line--iscott";
  }

  if (normalizedLine.startsWith("He'll reach out")) {
    return "wild-story-contact-follow";
  }

  return undefined;
}

function ProjectImage({
  src,
  alt,
  sizes = "100vw",
  direction = "left",
}: {
  src: string;
  alt: string;
  sizes?: string;
  direction?: "left" | "right";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, viewportTight);
  return (
    <motion.div
      ref={ref}
      className="wild-image-frame"
      variants={direction === "left" ? imageReveal : imageRevealRight}
      initial="initial"
      animate={inView ? "animate" : "initial"}
    >
      <AspectRatioImage
        src={src}
        alt={alt}
        priority={false}
        sizes={sizes}
        className="object-contain object-center"
      />
    </motion.div>
  );
}

function ZoomableFillImage({
  src,
  alt,
  sizes,
  className,
  title,
  quality,
  style,
}: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
  title?: string;
  quality?: number;
  style?: CSSProperties;
}) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        quality={quality}
        style={style}
      />
      <button
        type="button"
        className="wild-zoom-hit-area"
        onClick={() => setIsLightboxOpen(true)}
        aria-label={`Enlarge ${alt}`}
      />
      <ImageLightbox
        open={isLightboxOpen}
        src={src}
        alt={alt}
        title={title}
        onClose={() => setIsLightboxOpen(false)}
      />
    </>
  );
}

export default function Home() {
  const [wildfireLightboxIndex, setWildfireLightboxIndex] = useState<number | null>(null);
  const [avatarWakeKey, setAvatarWakeKey] = useState(0);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [callNumberVisible, setCallNumberVisible] = useState(false);
  const handleCallNow = useCallback(() => {
    setCallNumberVisible(true);
    try {
      void navigator.clipboard?.writeText("+1(443) 797-2166");
    } catch {}
    setPhoneCopied(true);
    window.setTimeout(() => {
      setPhoneCopied(false);
      setCallNumberVisible(false);
    }, 2200);
  }, []);
  const showCallNumber = useCallback(() => setCallNumberVisible(true), []);
  const hideCallNumber = useCallback(() => {
    if (!phoneCopied) {
      setCallNumberVisible(false);
    }
  }, [phoneCopied]);
  const activeWildfireImage =
    wildfireLightboxIndex === null ? null : wildfireLightboxImages[wildfireLightboxIndex] ?? null;
  const activeWildfireImagePosition = wildfireLightboxIndex === null ? 0 : wildfireLightboxIndex + 1;

  const wakeIScottAvatar = useCallback(() => {
    setAvatarWakeKey((current) => current + 1);
  }, []);

  const handleIScottCtaClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      wakeIScottAvatar();

      const target = document.getElementById("talk-to-iscott");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#talk-to-iscott`,
      );
    },
    [wakeIScottAvatar],
  );

  const closeWildfireLightbox = useCallback(() => {
    setWildfireLightboxIndex(null);
  }, []);

  const showPreviousWildfireImage = useCallback(() => {
    setWildfireLightboxIndex((current) =>
      current === null ? current : (current - 1 + wildfireLightboxImages.length) % wildfireLightboxImages.length,
    );
  }, []);

  const showNextWildfireImage = useCallback(() => {
    setWildfireLightboxIndex((current) =>
      current === null ? current : (current + 1) % wildfireLightboxImages.length,
    );
  }, []);

  useEffect(() => {
    if (wildfireLightboxIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWildfireLightbox();
      }

      if (event.key === "ArrowLeft") {
        showPreviousWildfireImage();
      }

      if (event.key === "ArrowRight") {
        showNextWildfireImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeWildfireLightbox,
    showNextWildfireImage,
    showPreviousWildfireImage,
    wildfireLightboxIndex,
  ]);

  return (
    <div id="top" className="wild-home">
      <style>{`
        #top.wild-home {
          --ww-box-gradient:
            radial-gradient(ellipse at 34% 8%, rgba(246, 211, 154, 0.08), transparent 24rem),
            radial-gradient(ellipse at 78% 18%, rgba(224, 168, 90, 0.065), transparent 26rem),
            linear-gradient(105deg, rgba(74, 36, 13, 0.32) 0%, rgba(63, 29, 10, 0.34) 52%, rgba(45, 19, 7, 0.38) 100%);
          background: transparent !important;
        }

        #top.wild-home .wild-section,
        #top.wild-home #iscott-sales,
        #top.wild-home #what-is-wildworks,
        #top.wild-home #services,
        #top.wild-home #wildworks-ai,
        #top.wild-home #wildworks-proof,
        #top.wild-home #project-wildfire,
        #top.wild-home #signature-work,
        #top.wild-home .wild-section--intro,
        #top.wild-home .wild-section--tight,
        #top.wild-home .wild-section--different,
        #top.wild-home .wild-section--ai-websites {
          background: transparent !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }

        #top.wild-home :is(.money-panel, .wild-card, .wild-answer-card, .wild-identity-card, .wild-stat, .wild-project-card, .wild-story-card, .wild-process-step) {
          border-color: rgba(232, 182, 109, 0.14) !important;
          background: var(--ww-box-gradient) !important;
          box-shadow:
            0 12px 32px rgba(16, 6, 1, 0.18),
            inset 0 1px 0 rgba(246, 211, 154, 0.08) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-bg,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
          background: transparent !important;
          background-image: none !important;
          background-color: transparent !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell {
          display: block !important;
          aspect-ratio: 1376 / 768 !important;
          min-height: clamp(28rem, 53vw, 44rem) !important;
          background: #140702 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-image {
          object-fit: cover !important;
          object-position: center center !important;
          filter: saturate(0.96) contrast(1.03) brightness(0.92) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
          position: absolute !important;
          inset: 0 !important;
          z-index: 5 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-end !important;
          align-items: flex-start !important;
          width: min(62%, 46rem) !important;
          min-height: 0 !important;
          padding: 0 0 clamp(2rem, 4.1vw, 3.85rem) clamp(1.65rem, 4.8vw, 4.45rem) !important;
          pointer-events: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay h3,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay p,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay .wild-story-cta {
          position: static !important;
          inset: auto !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
          max-width: min(100%, 41rem) !important;
          margin: 0 !important;
          font-size: clamp(2.3rem, 4.35vw, 4.85rem) !important;
          line-height: 0.88 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line {
          display: block !important;
          width: auto !important;
          max-width: 100% !important;
          white-space: normal !important;
          text-wrap: balance !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
          max-width: min(100%, 43rem) !important;
          margin: clamp(0.8rem, 1.35vw, 1.05rem) 0 0 !important;
          padding: 0 !important;
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          font-size: clamp(1.42rem, 2.05vw, 2.15rem) !important;
          font-weight: 820 !important;
          line-height: 1.18 !important;
          text-align: left !important;
          text-shadow:
            0 0.14rem 0.42rem rgba(5, 2, 0, 0.94),
            0 0 1.1rem rgba(4, 1, 0, 0.58) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-cta {
          pointer-events: auto !important;
          min-height: 52px !important;
          margin-top: clamp(1rem, 1.75vw, 1.35rem) !important;
          padding: 0.9rem 1.34rem !important;
          font-size: clamp(1.05rem, 1.28vw, 1.18rem) !important;
        }

        @media (max-width: 899px) {
          #top.wild-home #signature-work .wild-story-card--featureSell {
            aspect-ratio: auto !important;
            min-height: clamp(31rem, 92vw, 38rem) !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
            width: 100% !important;
            padding: 0 clamp(1.05rem, 5vw, 1.75rem) clamp(1.35rem, 6vw, 2.15rem) !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
            max-width: min(100%, 24rem) !important;
            font-size: clamp(2.05rem, 8vw, 3.35rem) !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            max-width: min(100%, 33rem) !important;
            font-size: clamp(1.08rem, 4.3vw, 1.72rem) !important;
          }
        }

        #top.wild-home :is(.money-panel, .wild-card, .wild-answer-card, .wild-identity-card, .wild-stat, .wild-project-card, .wild-story-card, .wild-process-step)::before,
        #top.wild-home :is(.money-panel, .wild-card, .wild-answer-card, .wild-identity-card, .wild-stat, .wild-project-card, .wild-story-card, .wild-process-step)::after,
        #top.wild-home .wild-section-heading::before,
        #top.wild-home .wild-section-heading::after,
        #top.wild-home #iscott-sales .wild-copy-stack::before,
        #top.wild-home #iscott-sales .wild-copy-stack::after,
        #top.wild-home #wildworks-ai .wild-ai-copy::before,
        #top.wild-home #wildworks-ai .wild-ai-copy::after,
        #top.wild-home #wildworks-proof .wild-copy-stack::before,
        #top.wild-home #wildworks-proof .wild-copy-stack::after,
        #top.wild-home #signature-work .wild-story-copy--overlay::before,
        #top.wild-home #signature-work .wild-story-copy--overlay::after {
          content: none !important;
          display: none !important;
          height: 0 !important;
          margin: 0 !important;
          background: none !important;
          box-shadow: none !important;
        }

        #top.wild-home .wild-card-icon {
          background: rgba(95, 52, 21, 0.32) !important;
          border-color: rgba(246, 211, 154, 0.2) !important;
        }

        #top.wild-home #iscott-sales #talk-to-iscott.money-panel.wild-iscott-panel {
          border-color: rgba(232, 182, 109, 0.14) !important;
          background: var(--ww-box-gradient) !important;
          box-shadow:
            0 12px 32px rgba(16, 6, 1, 0.18),
            inset 0 1px 0 rgba(246, 211, 154, 0.08) !important;
        }
      `}</style>

      <motion.section
        className="wild-hero discordSection discordSection--1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="wild-hero-media">
          <AspectRatioImage
            src="/ww-art-wilds.jpeg"
            alt="WildWorks natural stone steps and landscape with the artist standing beside the work"
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <motion.div
          className="wild-hero-copy"
          variants={slowStagger}
          initial="initial"
          animate="animate"
        >
          <motion.div className="wild-brand-lockup" variants={fadeInLeft}>
            <span
              className="wild-hero-wordmark-text-orange"
              style={{
                display: "block",
                width: "max-content",
                maxWidth: "100%",
                color: "#e8b66d",
                WebkitTextFillColor: "#e8b66d",
                backgroundImage: "none",
                WebkitBackgroundClip: "border-box",
                backgroundClip: "border-box",
                fontFamily:
                  '"Goudy Old Style", "Baskerville Old Face", Garamond, var(--font-serif), Georgia, serif',
                fontSize: "clamp(3rem, 7.3vw, 6.6rem)",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: 0.82,
                letterSpacing: 0,
                textShadow:
                  "0 0 14px rgba(224, 168, 90, 0.14), 0 2px 18px rgba(16, 6, 1, 0.76)",
              }}
            >
              WildWorks
            </span>
          </motion.div>
          <motion.h1 className="wild-hero-headline wild-hero-headline--solid" variants={softScaleIn}>
            <span
              className="wild-hero-headline__line wild-hero-headline__line--makes-home"
              style={{ color: "#f7d9a5", WebkitTextFillColor: "#f7d9a5" }}
            >
              Makes Your Home
            </span>
            <span
              className="wild-hero-headline__line wild-hero-headline__line--irresistible"
              style={{
                color: "#e79d45",
                WebkitTextFillColor: "#e79d45",
                marginTop: "0.12em",
              }}
            >
              <em>Legendary</em>
            </span>
          </motion.h1>
          <motion.p
            className="wild-lede"
            variants={fadeInLeft}
            style={{
              ...noWhiteTextStyle,
              fontSize: "clamp(1.06rem, 1.52vw, 1.42rem)",
              lineHeight: 1.36,
            }}
          >
            by Creating <span className="wild-hero-lede-accent">Beautiful Things</span>, and Solving{" "}
            <span className="wild-hero-lede-accent">Real-World{" "}<br />Problems</span> that Make Your Property{" "}
            <span className="wild-hero-lede-accent">UNFORGETTABLE</span>
          </motion.p>
          <motion.div className="wild-cta-row" variants={fadeInUp}>
            <a href="#talk-to-iscott" className="money-cta money-cta--primary" onClick={handleIScottCtaClick}>
              <Sparkles aria-hidden className="h-5 w-5" />
              <span>Talk to iScott</span>
            </a>
            <span
              style={{
                display: "inline-flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={showCallNumber}
              onMouseLeave={hideCallNumber}
            >
              <a
                href="tel:+14437972166"
                className="money-cta"
                onClick={handleCallNow}
                onFocus={showCallNumber}
                onBlur={hideCallNumber}
                aria-describedby="hero-call-number-reveal"
              >
                <Phone aria-hidden className="h-5 w-5" />
                <span>Call Now</span>
              </a>
              {callNumberVisible || phoneCopied ? (
                <motion.a
                  id="hero-call-number-reveal"
                  href="tel:+14437972166"
                  onClick={handleCallNow}
                  aria-label="Call or copy Scott's number, +1(443) 797-2166"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.55rem)",
                    left: "50%",
                    zIndex: 8,
                    minWidth: "max-content",
                    transform: "translateX(-50%)",
                    border: "1px solid rgba(247, 217, 165, 0.34)",
                    borderRadius: 8,
                    background:
                      "linear-gradient(180deg, rgba(78, 39, 13, 0.94), rgba(43, 20, 7, 0.94))",
                    boxShadow:
                      "0 10px 24px rgba(16, 6, 1, 0.34), inset 0 1px 0 rgba(247, 217, 165, 0.16)",
                    color: "#f7d9a5",
                    WebkitTextFillColor: "#f7d9a5",
                    fontFamily:
                      '"Goudy Old Style", "Baskerville Old Face", Garamond, var(--font-serif), Georgia, serif',
                    fontSize: "clamp(1.04rem, 1.45vw, 1.26rem)",
                    fontWeight: 750,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                    padding: "0.55rem 0.75rem",
                    textDecoration: "none",
                    textShadow: "0 2px 12px rgba(16, 6, 1, 0.48)",
                  }}
                >
                  {phoneCopied ? "Copied! +1(443) 797-2166" : "+1(443) 797-2166"}
                </motion.a>
              ) : null}
            </span>
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.section
        id="iscott-sales"
        className="wild-section wild-section--intro discordSection discordSection--1"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-split wild-split--lead">
          <div className="wild-copy-stack">
            <motion.p className="wild-kicker" variants={fadeInLeft} style={noWhiteKickerStyle}>
              Built to Expedite Your Needs
            </motion.p>
            <motion.h2
              className="wild-section-title wild-iscott-title wild-iscott-title--front-door"
              aria-label="iScott is the Front Door"
            >
              <span className="wild-iscott-title__row">
                <span className="wild-iscott-title__segment wild-iscott-title__segment--one">iScott</span>{" "}
                <span className="wild-iscott-title__segment wild-iscott-title__segment--two">is the</span>
              </span>
              <span className="wild-iscott-title__segment wild-iscott-title__segment--three">
                Front Door
              </span>
            </motion.h2>
            <motion.p
              className="wild-body wild-iscott-body"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              Scott created his Digital Twin — iScott — to answer all of
              your questions.
            </motion.p>
            <motion.p
              className="wild-body wild-iscott-body"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              Click the &quot;Talk to iScott&quot; button, and talk to iScott like you
              would any other person.
            </motion.p>
            <motion.div className="money-step-list wild-iscott-steps-inline" variants={stagger}>
              {iScottSteps.map((item, index) => (
                <motion.div key={item.title} variants={smallDrift} custom={index}>
                  <span>{index + 1}</span>
                  <div className="money-step-content">
                    <p>
                      <BrandText>{item.title}</BrandText>
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            <motion.p
              className="wild-body wild-iscott-body"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              iScott walks you through the entire process, and will brief the
              real Scott on all the details so that on your first conversation,
              you literally hit the ground running.
            </motion.p>
          </div>

          <motion.div id="talk-to-iscott" className="money-panel wild-iscott-panel" variants={fadeInRight}>
            <p className="money-panel-kicker">
              <BrandText>WildWorks Concierge</BrandText>
            </p>
            <h2 className="wild-start-title" aria-label="Start with iScott">
              <span className="wild-start-title__start">Start</span>{" "}
              <span className="wild-start-title__with">with</span>{" "}
              <span className="wild-start-title__name">iScott</span>
            </h2>
            <IScottSection variants={softScaleIn} wakeKey={avatarWakeKey} />
          </motion.div>
        </div>
      </motion.section>

      {showWildWorksIdentitySection ? (
        <motion.section
        id="what-is-wildworks"
        className="wild-section wild-section--identity discordSection discordSection--2"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-identity-shell">
          <div className="wild-section-heading wild-identity-heading">
            <motion.p className="wild-kicker" variants={fadeInLeft} style={noWhiteKickerStyle}>
              <BrandText>What Is WildWorks?</BrandText>
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["WildWorks is", "Two Things."]} />
            </motion.h2>
            <motion.p className="wild-body wild-body--center" variants={fadeInRight} style={noWhiteTextStyle}>
              <BrandText>
              It is Scott&apos;s real-world eye for property, stone, terrain, and
              problem solving. And it is WildWorks.Ai, built to make that eye
              available earlier, farther away, and with less wasted motion.
              </BrandText>
            </motion.p>
          </div>

          <motion.div className="wild-identity-grid" variants={stagger}>
            {wildWorksModes.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.title}
                  className="wild-identity-card"
                  variants={cardDrift}
                  custom={index}
                >
                  <div className="wild-identity-media">
                    <ZoomableFillImage
                      src={item.image}
                      alt={item.alt}
                      sizes="(max-width: 899px) 100vw, 34vw"
                      className="wild-identity-img"
                      title={item.title}
                    />
                  </div>
                  <div className="wild-identity-copy">
                    <div className="wild-identity-card-top">
                      <span>{item.number}</span>
                      <Icon aria-hidden className="h-6 w-6" />
                    </div>
                    <h3 className="wild-line-title">
                      <LineTitle lines={item.titleLines} />
                    </h3>
                    <p>
                      <BrandText>{item.body}</BrandText>
                    </p>
                    <ul>
                      {item.points.map((point) => (
                        <li key={point}>
                          <CheckCircle2 aria-hidden />
                          <span>
                            <BrandText>{point}</BrandText>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
        </motion.section>
      ) : null}

      {showWildWorksAiSection ? (
        <motion.section
          id="wildworks-ai"
          className="wild-section wild-section--ai discordSection discordSection--2"
          variants={slowStagger}
          initial="initial"
          whileInView="animate"
          viewport={viewportReplay}
          style={{ paddingTop: "clamp(2.5rem, 4.8vw, 4rem)" }}
        >
        <div className="wild-ai-shell">
          <div
            className="wild-copy-stack wild-ai-copy"
            style={{ alignContent: "start", gap: "clamp(0.38rem, 0.75vw, 0.62rem)" }}
          >
            <motion.h2
              className="wild-section-title wild-line-title"
              aria-label={'What does it mean, to "Live Like A King?"'}
              variants={softScaleIn}
              style={{ marginTop: 0 }}
            >
              <LineTitle lines={["What does it mean, to", "\"Live Like A King?\""]} />
            </motion.h2>
            <motion.p
              className="wild-ai-subtitle"
              variants={fadeInRight}
              style={{
                color: "#a76431",
                WebkitTextFillColor: "#a76431",
                backgroundImage: "none",
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(1.35rem, 1.85vw, 1.85rem)",
                fontWeight: 800,
                lineHeight: 1.08,
                margin: "clamp(0.25rem, 0.7vw, 0.52rem) 0 clamp(0.42rem, 0.9vw, 0.72rem)",
                textShadow: "0 2px 13px rgba(0, 0, 0, 0.5)",
              }}
            >
              State of the Art Ai for Everyone on Earth.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              <BrandText>
              Right now, Scott is hands on building WildWorks.Ai Beta himself,
              using his taste, his judgment, his 40+ years of design experience,
              and incorporating Ai agents to study his protocols so they can
              eventually carry the entire workload. When this scales,
              WildWorks.Ai will be able to bring the most exquisitely beautiful
              designs to anyone on Earth at a price point that will continuously
              move towards zero.
              </BrandText>
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              That is what Scott wants: everyone on Earth surrounded by the
                world&apos;s most beautiful things. That is what &quot;Live Like A King&quot;
              means.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Scott is regarded as one of the finest landscape designers in the
              world. Right now, he is at the peak of his career, and bolting Ai
              design onto his system is turbocharging his design abilities.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Who can he help? The range is everything from literal zero-budget
              DIY design help for people using materials already on site and
              doing all the labor themselves, through every kind of project in
              between: design only, help finding a contractor in your area,
              remote oversight from afar, or full hands on design build and
              problem solving for Lifestyles of the Rich and Famous level
              projects where Scott is on site and overseeing the work himself,
              personally.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Everything is on the table. Scott will help you in every way he
              can personally, and iScott will be there in the future to help you
              in every way imaginable.
            </motion.p>
            <motion.div
              className="wild-cta-row wild-cta-row--center"
              variants={fadeInUp}
              style={{
                justifyContent: "center",
                width: "min(100%, 42rem)",
                marginTop: "clamp(1rem, 1.7vw, 1.35rem)",
              }}
            >
              <a href="#talk-to-iscott" className="money-cta money-cta--primary" onClick={handleIScottCtaClick}>
                <Sparkles aria-hidden className="h-5 w-5" />
                <span>
                  <BrandText>Start with WildWorks.Ai</BrandText>
                </span>
              </a>
            </motion.div>
          </div>

          <motion.div className="money-panel wild-ai-panel" variants={fadeInRight}>
            <div className="wild-ai-human-frame" aria-label="Scott and WildWorks stone art">
              <ZoomableFillImage
                src="/ww-art-wilds.jpeg"
                alt="Scott standing beside WildWorks stonework"
                sizes="(max-width: 899px) 100vw, 28vw"
                className="wild-ai-human-img"
                title="Scott and WildWorks Stone Art"
              />
            </div>
            <p className="money-panel-kicker wild-preserve-ai-case">Ai + Human Judgement</p>
            <h3 className="wild-line-title" aria-label="iScott Gathers, Scott Designs with Ai, You Move Forward.">
              <LineTitle lines={["iScott Gathers,", "Scott Designs with Ai,", "You Move Forward."]} />
            </h3>
            <p>
              Using Ai is not replacing human intelligence and creativity, it is
              turbocharging it. Scott still uses his natural experience and
              abilities, but is able to produce great designs 100x faster than
              with a pencil and paper, or traditional computer aided design,
              plus, Ai opens a whole new world of design ideas that Scott would
              have never dreamed of. It is just all around wonderful.
            </p>
            <p>
              <BrandText>
              iScott collects the details and confirms how to reach you, then
              hands the project to Scott. Scott reviews the area, gets back to
              you with questions and comments, and uses 40+ years of practical
              judgement, taste, engineering sense, and Ai assisted design to give
              you an exquisitely beautiful design, a useful fix, or the clearest
              next step. In beta, you work directly with Scott while WildWorks.Ai
              becomes the system you help build.
              </BrandText>
            </p>
          </motion.div>

          <motion.div className="wild-ai-card-grid" variants={stagger}>
            {aiCapabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article key={item.title} className="wild-card wild-ai-card wild-ai-capability-card" variants={cardDrift} custom={index}>
                  <div className="wild-ai-card-heading">
                    <div className="wild-card-icon">
                      <Icon aria-hidden className="h-6 w-6" />
                    </div>
                    <h3 className="wild-ai-card-title">
                      <span>{item.titleParts[0]}</span>
                      {" "}
                      <span>{item.titleParts[1]}</span>
                    </h3>
                  </div>
                  <p>
                    <BrandText>{item.body}</BrandText>
                  </p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
        </motion.section>
      ) : null}

      <motion.section
        id="project-wildfire"
        className="wild-section wild-section--wildfire-feature discordSection discordSection--4"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-wildfire-spread-shell">
          <div className="wild-section-heading wild-wildfire-spread-heading">
            <motion.h2
              className={`wild-wildfire-flame-title${SHOW_PROJECT_WILDFIRE_FLAMES ? "" : " wild-wildfire-flame-title--dormant"}`}
              variants={softScaleIn}
              aria-label="Project Wildfire"
            >
              {SHOW_PROJECT_WILDFIRE_FLAMES ? (
                <span className="wild-wildfire-flames" aria-hidden>
                  <span className="wild-wildfire-flame wild-wildfire-flame--one" />
                  <span className="wild-wildfire-flame wild-wildfire-flame--two" />
                  <span className="wild-wildfire-flame wild-wildfire-flame--three" />
                  <span className="wild-wildfire-flame wild-wildfire-flame--four" />
                  <span className="wild-wildfire-flame wild-wildfire-flame--five" />
                </span>
              ) : null}
              <span className="wild-wildfire-flame-title__text">Project Wildfire</span>
            </motion.h2>
            <motion.h3 className="wild-section-title wild-line-title wild-wildfire-title" variants={fadeInUp}>
              <LineTitle
                lines={[
                  "It Started with a Fireplace.....",
                ]}
              />
            </motion.h3>
          </div>

          <motion.div className="wild-wildfire-spread" variants={stagger}>
            {wildfireNightImages.map((image, index) => (
              <motion.figure
                key={image.src}
                className={`wild-wildfire-photo ${image.className}`}
                variants={cardDrift}
                custom={index}
              >
                <button
                  type="button"
                  className="wild-wildfire-photo-button"
                  onClick={() => setWildfireLightboxIndex(index)}
                  aria-label={`Enlarge ${image.alt}`}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes={
                      image.className === "wild-wildfire-photo--hero"
                        ? "(max-width: 899px) 100vw, 58vw"
                        : "(max-width: 899px) 100vw, 34vw"
                    }
                  />
                </button>
              </motion.figure>
            ))}
          </motion.div>

          {showWildfireInspirationSection ? (
            <>
              <motion.p
                className="wild-body wild-wildfire-inspiration-note"
                variants={fadeInUp}
                style={{
                  ...noWhiteBlendTextStyle,
                  maxWidth: "min(100%, 58rem)",
                  margin: "clamp(1.35rem, 2.7vw, 2.2rem) auto 0",
                  fontSize: "clamp(1.02rem, 1.6vw, 1.3rem)",
                  lineHeight: 1.58,
                  textAlign: "center",
                  textShadow: "0 2px 13px rgba(0, 0, 0, 0.5)",
                }}
              >
                Scott designed the outdoor fireplace. When he went searching for
                ideas for an outdoor lounge, he came across the first image, which
                led him next to the patio image. As you can see, though they were
                images, he was looking for real things. They ended up being Ai
                images. A dead giveaway is one post on the outdoor lounge that would
                never exist in reality.
              </motion.p>

              <motion.div
                className="wild-wildfire-inspiration-grid"
                variants={stagger}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))",
                  alignItems: "start",
                  maxWidth: "78rem",
                  margin: "clamp(1rem, 2.2vw, 1.75rem) auto 0",
                  gap: "clamp(0.85rem, 1.45vw, 1.25rem)",
                }}
              >
                {wildfireInspirationImages.map((image, index) => (
                  <motion.figure
                    key={image.src}
                    className={`wild-wildfire-inspiration-card ${image.className}`}
                    variants={cardDrift}
                    custom={index}
                    style={{
                      position: "relative",
                      margin: 0,
                      overflow: "hidden",
                      border: "1px solid rgba(246, 211, 154, 0.18)",
                      borderRadius: "8px",
                      background: "transparent",
                      boxShadow:
                        "0 22px 62px rgba(16, 6, 1, 0.44), inset 0 1px 0 rgba(246, 211, 154, 0.08)",
                    }}
                  >
                    <button
                      type="button"
                      className="wild-wildfire-inspiration-button"
                      onClick={() => setWildfireLightboxIndex(wildfireNightImages.length + index)}
                      aria-label={`Enlarge ${image.alt}`}
                      style={{
                        position: "relative",
                        display: "block",
                        width: "100%",
                        minHeight: "100%",
                        padding: 0,
                        border: 0,
                        background: "transparent",
                        color: "inherit",
                        cursor: "zoom-in",
                      }}
                    >
                      <Image
                        src={image.src}
                        alt={image.alt}
                        width={image.width}
                        height={image.height}
                        sizes="(max-width: 899px) 100vw, 38vw"
                        className="wild-wildfire-inspiration-image"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                        }}
                      />
                    </button>
                  </motion.figure>
                ))}
              </motion.div>
            </>
          ) : null}

          <motion.div
            className="wild-wildfire-sequence-callout"
            variants={fadeInUp}
            aria-label="Then Came the Patio. Then Came the Outdoor Lounge."
          >
            <span className="wild-wildfire-sequence-callout__line wild-wildfire-sequence-callout__line--patio">
              Then Came the Patio.
            </span>
            <span className="wild-wildfire-sequence-callout__line wild-wildfire-sequence-callout__line--lounge">
              Then Came the Outdoor Lounge.
            </span>
          </motion.div>

          <motion.div className="wild-wildfire-build-note" variants={fadeInUp}>
            <span className="wild-wildfire-build-note__line">
              We Documented Every Step of
            </span>
            <span className="wild-wildfire-build-note__line">
              the Build, from Breaking Ground
            </span>
            <span className="wild-wildfire-build-note__line">
              through the First Wood Fire.
            </span>
          </motion.div>

          <motion.div className="wild-cta-row wild-cta-row--center" variants={fadeInUp}>
            <Link href="/pages/Wildfire" className="money-cta money-cta--primary">
              <Flame aria-hidden className="h-5 w-5" />
              <span>Check Out Project Wildfire</span>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {activeWildfireImage ? (
        <div
          className="wildfire-lightbox discordSection discordSection--lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={activeWildfireImage.alt}
        >
          <div className="wildfire-lightbox-bar">
            <span>
              Project Wildfire {activeWildfireImagePosition} of {wildfireLightboxImages.length}
            </span>
            <button type="button" onClick={closeWildfireLightbox} aria-label="Close enlarged image">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--left"
            onClick={showPreviousWildfireImage}
            aria-label="Previous Project Wildfire image"
          >
            <ChevronLeft aria-hidden className="h-6 w-6" />
          </button>
          <div className="wildfire-lightbox-image">
            <Image
              src={activeWildfireImage.src}
              alt={activeWildfireImage.alt}
              fill
              sizes="100vw"
              className="object-contain"
              quality={92}
            />
          </div>
          <button
            type="button"
            className="wildfire-lightbox-nav wildfire-lightbox-nav--right"
            onClick={showNextWildfireImage}
            aria-label="Next Project Wildfire image"
          >
            <ChevronRight aria-hidden className="h-6 w-6" />
          </button>
        </div>
      ) : null}

      <motion.section
        id="wildworks-proof"
        className="wild-section discordSection discordSection--3"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-split">
          <ProjectImage
            src="/ww-art-tree-of-life.jpeg"
            alt="Tree of Life natural stone patio concept with creeping perennial leaves"
            sizes="(max-width: 900px) 100vw, 48vw"
            direction="left"
          />
          <div className="wild-copy-stack">
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["The Tree of", "Life Natural", "Stone Patio"]} />
            </motion.h2>
            <motion.p className="wild-body" variants={fadeInRight} style={noWhiteBlendTextStyle}>
              An artsy young couple of Irish descent in Mount Washington, Baltimore City,
              wanted a natural stone patio. I had always been fascinated by the
              Celtic Tree of Life, so I asked what they thought about building
              one in their back yard, with rock garden perennials as the
              leaves. They loved the idea, and I am still grateful they let me
              build them this work of art.
            </motion.p>
            <motion.p className="wild-body" variants={fadeInRight} style={noWhiteBlendTextStyle}>
              What I, Scott G. Dietz, look for most in this world, is people
              who want exquisite works of art made real.
            </motion.p>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="signature-work"
        className="wild-section discordSection discordSection--4"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-section-heading">
          <motion.h2
            className="wild-section-title wild-signature-title"
            variants={softScaleIn}
            aria-label="What Could be Cooler Than Having a RUINS of Your Own?"
          >
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__one">What Could be Cooler</span>
            </span>
            {" "}
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__two">Than Having a RUINS</span>{" "}
              <span className="wild-signature-title__three">of Your Own?</span>
            </span>
          </motion.h2>
        </div>

        <div className="wild-story-list">
          {signatureWork.map((project, index) => (
            <motion.article
              key={project.title}
              className={`wild-story-card wild-story-card--${project.variant}`}
              variants={cardDrift}
              custom={index}
              style={
                project.variant === "featureSell"
                  ? {
                      position: "relative",
                      isolation: "isolate",
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      width: "100%",
                      aspectRatio: "1376 / 768",
                      minHeight: 0,
                      justifySelf: "center",
                      overflow: "hidden",
                      border: "1px solid rgba(246, 211, 154, 0.22)",
                      borderRadius: "8px",
                      background: "transparent",
                      boxShadow:
                        "0 2rem 5rem rgba(7, 2, 0, 0.46), inset 0 1px 0 rgba(246, 211, 154, 0.12)",
                    }
                  : undefined
              }
            >
              {project.variant === "featureSell" ? (
                <>
                  <div
                    className="wild-story-feature-sell-bg"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 0,
                    }}
                  >
                    <ZoomableFillImage
                      src={project.image}
                      alt={project.alt}
                      sizes="(max-width: 900px) 100vw, 86vw"
                      className="wild-story-feature-sell-image"
                      quality={90}
                      title={project.title}
                      style={{
                        objectFit: "cover",
                        objectPosition: "center center",
                        filter: "saturate(0.96) contrast(1.03) brightness(0.92)",
                      }}
                    />
                  </div>
                  <div
                    className="wild-story-copy wild-story-copy--overlay"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 4,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "flex-start",
                      width: "min(62%, 46rem)",
                      minHeight: 0,
                      padding:
                        "0 0 clamp(2rem, 4.1vw, 3.85rem) clamp(1.65rem, 4.8vw, 4.45rem)",
                      pointerEvents: "none",
                    }}
                  >
                    <h3
                      className="wild-line-title wild-sell-feature-title"
                      style={{
                        position: "static",
                        maxWidth: "min(100%, 41rem)",
                        margin: 0,
                        fontSize: "clamp(2.3rem, 4.35vw, 4.85rem)",
                        lineHeight: 0.88,
                        pointerEvents: "none",
                        backgroundImage: "var(--ww-aiasap-gold-blend)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        WebkitTextFillColor: "transparent",
                        textShadow:
                          "0 0.16rem 0.5rem rgba(5, 2, 0, 0.92), 0 0 1.4rem rgba(6, 3, 1, 0.6)",
                      }}
                    >
                      {project.titleLines.map((line, lineIndex) => (
                        <span
                          key={line}
                          className={`wild-line-title__line wild-sell-feature-title__line wild-sell-feature-title__line--${["one", "two", "three"][lineIndex]}`}
                          style={{
                            display: "block",
                            width: "auto",
                            maxWidth: "100%",
                            fontSize: "1em",
                            lineHeight: 0.95,
                            color: "transparent",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          {line}
                        </span>
                      ))}
                    </h3>
                    <p
                      className="wild-sell-feature-proof"
                      style={{
                        position: "static",
                        maxWidth: "min(100%, 43rem)",
                        margin: "clamp(0.8rem, 1.35vw, 1.05rem) 0 0",
                        color: "#f7d9a5",
                        WebkitTextFillColor: "#f7d9a5",
                        backgroundImage: "none",
                        WebkitBackgroundClip: "border-box",
                        backgroundClip: "border-box",
                        fontSize: "clamp(1.42rem, 2.05vw, 2.15rem)",
                        fontWeight: 820,
                        lineHeight: 1.18,
                        pointerEvents: "none",
                        textShadow:
                          "0 0.14rem 0.42rem rgba(5, 2, 0, 0.94), 0 0 1.1rem rgba(4, 1, 0, 0.58)",
                      }}
                    >
                      {project.body}
                    </p>
                    {project.href ? (
                      <Link
                        href={project.href}
                        className="money-cta money-cta--primary wild-story-cta wild-sell-feature-cta"
                        style={{
                          position: "static",
                          zIndex: 5,
                          marginTop: "clamp(1rem, 1.75vw, 1.35rem)",
                          minHeight: 52,
                          padding: "0.9rem 1.34rem",
                          fontSize: "clamp(1.05rem, 1.28vw, 1.18rem)",
                          pointerEvents: "auto",
                        }}
                      >
                        {project.cta}
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="wild-story-media">
                    <AspectRatioImage
                      src={project.image}
                      alt={project.alt}
                      sizes={
                        project.variant === "feature"
                          ? "(max-width: 900px) 100vw, 58vw"
                          : "(max-width: 900px) 100vw, 34vw"
                      }
                      className="object-contain object-center"
                    />
                  </div>
                  <div className="wild-story-copy">
                    <h3 className="wild-line-title">
                      <LineTitle lines={project.titleLines} />
                    </h3>
                    {Array.isArray(project.body) ? (
                      project.body.map((paragraph, i) => (
                        <p key={paragraph} className={`ww-c${i + 1}`}>
                          {paragraph.split("\n").map((line, j) => (
                            <Fragment key={j}>
                              {j > 0 ? <br /> : null}
                              <span className={signatureStoryLineClassName(line)}>
                                {renderSignatureStoryLine(line, handleIScottCtaClick)}
                              </span>
                            </Fragment>
                          ))}
                        </p>
                      ))
                    ) : (
                      <p>
                        <BrandText>{project.body}</BrandText>
                      </p>
                    )}
                    {project.href ? (
                      <Link
                        href={project.href}
                        className={project.variant === "feature" ? "money-cta money-cta--primary wild-story-cta" : "wild-inline-link"}
                        style={
                          project.variant === "feature"
                            ? {
                                minHeight: 62,
                                padding: "clamp(1.02rem, 1.9vw, 1.2rem) clamp(1.45rem, 3vw, 1.95rem)",
                                fontSize: "clamp(1.2rem, 1.9vw, 1.45rem)",
                              }
                            : undefined
                        }
                      >
                        {project.cta}
                      </Link>
                    ) : null}
                  </div>
                </>
              )}
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="services"
        className="wild-section discordSection discordSection--2"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-section-heading">
          <motion.p className="wild-kicker" variants={fadeInRight}>
            Services
          </motion.p>
          <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
            <LineTitle lines={["What WildWorks", "is Known for."]} />
          </motion.h2>
        </div>

        <div className="wild-card-grid">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.article key={service.title} className="wild-card" variants={cardDrift} custom={index}>
                <div
                  className="wild-card-heading"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    gap: "clamp(0.78rem, 1.35vw, 1rem)",
                    alignItems: "center",
                    marginBottom: "clamp(0.82rem, 1.45vw, 1.15rem)",
                  }}
                >
                  <div className="wild-card-icon" style={{ marginBottom: 0 }}>
                    <Icon aria-hidden className="h-6 w-6" />
                  </div>
                  <h3 className="wild-line-title" style={{ marginBottom: 0 }}>
                    <LineTitle lines={service.titleLines} />
                  </h3>
                </div>
                <div className="wild-card-body">
                  {service.body.map((paragraph) => (
                    <p key={paragraph}>
                      <BrandText>{paragraph}</BrandText>
                    </p>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </div>
      </motion.section>

      {showProcessSection ? (
        <motion.section
          id="process"
          className="wild-section wild-section--tight discordSection discordSection--2"
          variants={slowStagger}
          initial="initial"
          whileInView="animate"
          viewport={viewportReplay}
        >
          <div className="wild-section-heading">
            <motion.p
              className="wild-kicker wild-process-kicker"
              variants={fadeInRight}
              style={{ fontSize: "clamp(1.08rem, 1.85vw, 1.58rem)", lineHeight: 1 }}
            >
              How This Site Works
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["You Should", "Always Know", "What Comes Next."]} />
            </motion.h2>
          </div>
          <div className="wild-process-grid">
            {processSteps.map((step, index) => (
              <motion.article key={step.title} className="wild-process-step" variants={cardDrift} custom={index}>
                <div
                  className="wild-process-title"
                  role="heading"
                  aria-level={3}
                  style={{
                    marginBottom: "0.42rem",
                    color: "#a76431",
                    WebkitTextFillColor: "#a76431",
                    backgroundImage: "none",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    fontSize: "clamp(1.35rem, 2.15vw, 1.88rem)",
                    fontWeight: 900,
                    lineHeight: 1.02,
                    letterSpacing: 0,
                    whiteSpace: "nowrap",
                    textShadow: "0 2px 16px rgba(16, 6, 1, 0.62)",
                  }}
                >
                  {index + 1}. {step.title}
                </div>
                <p style={{ marginTop: 0 }}>
                  <BrandText>{step.body}</BrandText>
                </p>
              </motion.article>
            ))}
          </div>
        </motion.section>
      ) : null}

      {showWildWorksDifferentSection ? (
        <motion.section
          id="wildworks-different"
          className="wild-section wild-section--different discordSection discordSection--2"
          variants={slowStagger}
          initial="initial"
          whileInView="animate"
          viewport={viewportReplay}
        >
          <div className="wild-different-shell">
            <motion.p className="wild-kicker wild-preserve-ai-case" variants={fadeInLeft}>
              Bottom Line
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title wild-different-title" variants={softScaleIn}>
              <LineTitle lines={["What Makes", "WildWorks.Ai Different?"]} />
            </motion.h2>
            <motion.div className="wild-different-copy" variants={fadeInRight}>
              <p>
                <BrandText>
                WildWorks.Ai is different because the system being built is not
                just software. It is Scott&apos;s 40+ years of design experience,
                his talent, his creative instincts, his practical building
                knowledge, and his use of state of the art technology all being
                brought together into one system.
                </BrandText>
              </p>
              <p>
                The goal is to give people anywhere on Earth designs as beautiful
                as anything they could receive from anyone else in the world, while
                continuously pushing the cost of great design down for ordinary
                people. A single mother in the heart of Africa, a grandmother in
                the Polynesian islands, or anyone living anywhere on Earth should
                be able to get surrounded by beautiful design.
              </p>
              <p>
                <BrandText>
                These designs come from Scott&apos;s mind, imagination, taste, and
                skill, then get magnified by Ai. If you love the pictures and work
                on this website, that is the difference: no one else on Earth can
                do exactly what WildWorks.Ai is doing unless they simply copy the
                ideas.
                </BrandText>
              </p>
            </motion.div>
          </div>
        </motion.section>
      ) : null}

      <motion.section
        id="ai-websites"
        className="wild-section wild-section--ai-websites discordSection discordSection--3"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-site-offer-shell">
          <div className="wild-section-heading wild-site-offer-heading">
            <motion.p className="wild-kicker wild-preserve-ai-case" variants={fadeInLeft}>
              Ai-Native Websites
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["Want a", "Website Like This?"]} />
            </motion.h2>
            <motion.p className="wild-body wild-body--center" variants={fadeInRight}>
              <BrandText>
                Scott Himself Built This Site End to End.
              </BrandText>
            </motion.p>
            <motion.p className="wild-body wild-body--center" variants={fadeInRight}>
              <BrandText>
                WildWorks is a Working Sample of a State of the Art Ai-Driven Website:
                Avatar Conversation, Ai Conversion, Lead Intake, Appointment Setting,
                Information Gathering, Full Automation; With Tasteful Look and Intuitive Feel.
              </BrandText>
            </motion.p>
            <motion.p className="wild-body wild-body--center" variants={fadeInRight}>
              <BrandText>
                If You Would Like to Discuss Scott Building a Website for You, Call
                or Text Scott +1(443) 797-2166 or Talk to iScott, and He Will Reach Out
                to Scott, Have Him Get in Contact With You.
              </BrandText>
            </motion.p>
            <motion.div className="wild-site-avatar-wrap" variants={fadeInUp}>
              <a
                href="#talk-to-iscott"
                className="wild-site-avatar-link"
                aria-label="Talk to iScott"
                onClick={handleIScottCtaClick}
              >
                <span className="wild-site-avatar-frame">
                  <Image
                    src="/Avatar1-live-startscreen.png"
                    alt="iScott Avatar"
                    fill
                    sizes="(max-width: 720px) 76vw, 20rem"
                    className="wild-site-avatar-img"
                    quality={86}
                  />
                  <span className="wild-site-avatar-overlay-cta money-cta money-cta--primary">
                    <Sparkles aria-hidden className="h-5 w-5" />
                    <span>Talk to iScott</span>
                  </span>
                </span>
              </a>
            </motion.div>
          </div>

          <motion.div className="wild-site-offer-grid" variants={stagger}>
            {aiWebsiteCapabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article key={item.title} className="wild-card wild-site-offer-card" variants={cardDrift} custom={index}>
                  <div className="wild-card-icon">
                    <Icon aria-hidden className="h-6 w-6" />
                  </div>
                  <h3 className="wild-line-title">
                    <LineTitle lines={item.titleLines} />
                  </h3>
                  <p>{item.body}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
