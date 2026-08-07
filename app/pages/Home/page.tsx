"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useInView, type Variants } from "framer-motion";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Compass,
  DollarSign,
  Flame,
  Globe2,
  Hammer,
  Home as HomeIcon,
  Images,
  MessageCircle,
  Phone,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";
import ImageLightbox from "../../components/ImageLightbox";
import PhoneNumberLine from "../../components/PhoneNumberLine";
import { getAnonymousVisitorId, getClientSessionId } from "../../lib/clientTelemetry";
import { STONEWORK_AUTHENTICITY_LINE } from "../../lib/wildworksCopy";

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
  color: "#f7d9a5",
  WebkitTextFillColor: "#f7d9a5",
  backgroundImage: "none",
};

const noWhiteKickerStyle = {
  color: "#f7d9a5",
  WebkitTextFillColor: "#f7d9a5",
  backgroundImage: "none",
};

const noWhiteBlendTextStyle = {
  color: "#f7d9a5",
  WebkitTextFillColor: "#f7d9a5",
  backgroundImage: "none",
  WebkitBackgroundClip: "border-box",
  backgroundClip: "border-box",
};

const showWildWorksIdentitySection = false;
const showProcessSection = false;
const showWildWorksDifferentSection = false;
const showWildWorksAiSection = false;
const showWildfireInspirationSection = false;

const iScottSteps = [
  {
    title: "Describe areas you'd like beautified or problem areas you may have.",
  },
  {
    title: "Talk through location and your timing preferences.",
  },
  {
    title: "Bounce ideas off iScott, and he will bounce ideas right back at you.",
  },
  {
    title: "If appropriate, iScott will set up either an in-person or video chat with the real Scott.",
  },
];

const wildWorksModes = [
  {
    number: "1",
    title: "The Real Human Scott",
    titleLines: ["The Real", "Human Scott"],
    body: "Scott Can Be on the Ground, Read the Land with His Own Eyes, Design the Work, and Build the Kind of Stone, Terrain, Water, Fire, and Garden Art That Makes a Property Feel Alive. For the Right Project, Scott Can Go Anywhere in the World.",
    points: [
      "In-Person Site Reads and Design/Build Work",
      "Travel Anywhere for the Right WildWorks Project",
      "Real Stone, Terrain, Planting, Water, Fire, and Finish Judgment",
    ],
    image: "/ww-art-wilds.jpeg",
    alt: "Scott standing beside a WildWorks natural stone landscape",
    icon: UserRound,
  },
  {
    number: "2",
    title: "WildWorks.Ai",
    titleLines: ["WildWorks.Ai"],
    body: "The Same Human Scott Can Start Remotely. Photos, Video, Zoom, Property Goals, Contractor Bids, and Problem Areas Can Be Organized by Ai Agents so Scott Can Diagnose, Iterate Designs Fast, Direct, and Oversee from Wherever He is to Wherever You Are.",
    points: [
      "Rapid Ai Assisted Design Iterations for People Anywhere",
      "Remote Diagnosis Through Photos, Video, and Zoom",
      "Use Your Contractor, Let Scott Help Find One, or Bring Scott in",
      "Ai Agents Learning How Scott Reads and Solves Real-World Property Work",
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
    body: "Start with iScott. Discuss Your Needs, Location, Goals, Travel Considerations, Timing, Budget Range, and How You Prefer to Be Reached. This is the First Doorway to World-Class Design Help from WildWorks.Ai.",
    icon: Camera,
  },
  {
    title: "Human Handoff",
    titleParts: ["Human", "Handoff"],
    body: "iScott Organizes the Details and Passes Them Off to the Real Scott, So Access to Beautiful Design Still Runs Through Human Taste, Judgement, and Experience While WildWorks.Ai is in Beta and Building Out the System.",
    icon: Wrench,
  },
  {
    title: "Design Iteration",
    titleParts: ["Design", "Iteration"],
    body: "Scott Uses 40+ Years of Taste, Field Judgement, Engineering Sense, and Ai Assisted Design to Turn Rough Photos and Goals Into Tasteful, Practical Options.",
    icon: Sparkles,
  },
];

const services = [
  {
    title: "Wild Design",
    titleLines: ["Wild Design"],
    body: [
      <>
        WildWorks is for People Who Want Designs at the Limits of Human Imagination, and a Contractor that Can
        Faithfully Bring Those Designs to Life. If You Want a Space Created with Exquisite Taste and Originality - You
        are the Kind of Client Scott is Looking for, <em>Wherever You are in the World.</em>
      </>,
      <>
        After Four Decades+ of Designing and Building Hands-On, Scott Does not Stop at Merely Cool Ideas. He Keeps
        Pushing Designs to New Heights and Carries Them into the Real World with the Judgement, Craft, and Experience
        They Require. <strong>Your Project Could be the Next Among the World&apos;s Wildest Builds.</strong>
      </>,
    ],
    icon: Sparkles,
  },
  {
    title: "Problem Solving",
    titleLines: ["Problem Solving"],
    body: [
      "Some Home and Garden Problems Get Lived with for Years - Even Decades. Water, Grading, Access, Wet Walls, Cracked Foundations, and Failed Repairs Can Become Part of the Property Because Nobody has Found the Real Cause or Built a Fix that Will Actually Hold.",
      "Scott Loves Challenges and Charges into the Problems Most Contractors Shy Away from, so Bring Him Your Hard Ones! He will Do All that is Possible to Analyze the Entire Issue Entirely, and Come Up with a Lasting, Practical Solution.",
    ],
    icon: Wrench,
  },
  {
    title: "Building / Engineering",
    titleLines: ["Building / Engineering"],
    body: [
      "WildWorks Builds are Made for the Real World: Sun, Cold, Water, Wear, Outdoors, and In. Every Material—from Stone to Steel, Wood to Tile and Concrete—is Durable, Strong, and Crafted with Engineering Integrity.",
      "Scott Often Revisits Projects Years Later, and is Always Surprised by How Cleanly the Work has Settled: No Blemishes, No Trip Hazards, No Shortcuts Showing Through. That is What Good Judgment, Engineering, and Hands-On Craft are for: Build It Right, Build It to Last, and Time will Judge It Fairly.",
    ],
    icon: Hammer,
  },
  {
    title: "Ballparks",
    titleLines: ["Ballparks"],
    body: [
      "40+ Years of Design and Build Experience Creates Practical Wisdom Which Scott Draws Upon to Give Ballpark Numbers Early, to Help Set Clear Expectations, and the Scope of Work, Before Any Design is to Begin.",
      "Once the Range and Scope are Real and Practical, Design Begins. You Move Forward Informed, Without Spending Time and Money Developing a Plan that Does not Fit the Budget.",
    ],
    icon: DollarSign,
  },
  {
    title: "How Much Can WildWorks Do?",
    titleLines: ["How Much Can WildWorks Do?"],
    body: [
      "WildWorks is the Place to Start Any Project, Any Material, Inside or Outside Your Home to Full Design/Build Work from the Ground Up. WildWorks Can Also Serve as the Design and Diagnosis Layer around the Contractor Team You Already have.",
      "Scott and His Crews Do Much of the Work in House, and We have a Full Roster of Trusted Allied Specialists to Call upon When Needed; Electricians, Plumbers, HVAC Specialists, Etc.",
    ],
    icon: Compass,
  },
  {
    title: "Anywhere in the World",
    titleLines: ["Anywhere in the World"],
    body: [
      "Start with What You have: Photographs, Videos, a Plan, a Problem, or Just a Dream. iScott Can Organize the Details so Scott has a Clear First Look at the Property and the Conversation Can Begin by Phone or Video Chat.",
      "Any Project, Anywhere in the World, Scott would be Super Happy to Travel to You, Design and Build – for You. Talk to iScott, Get Things Moving. Scott Can Start Remotely with a Design or Diagnosis Conversation, Even Design and Work through Budgets.",
    ],
    icon: Globe2,
  },
];

const signatureWork = [
  {
    title: "The Ruins",
    titleLines: ["The", "Ruins"],
    body: [
      "Want the Coolest Party Zone You Have Ever Seen — in Your Own Back Yard?",
      "If You've Got a Space, We Can Create an Area that Looks Like the Original Farmhouse the Neighborhood Was Built Around, and Turn It into a Purpose-Built Outdoor Kitchen Your Family Will Love, While Giving Your Home Incredible Resale Value.",
      "Wherever You Are, Anywhere in the World, If You Want a Space that is Unforgettable — Something People Will Talk About for Generations — Talk to iScott or Call Now.",
    ],
    image: "/ww-art-ruins.jpeg",
    alt: "The Ruins stonework garden and reflecting pool by WildWorks",
    variant: "feature",
    href: "/pages/The-ruins",
    cta: "Explore the Ruins",
  },
  {
    title: "My Work Sells People's Homes. Period.",
    titleLines: ["My Work", "Sells People's Homes. Period."],
    body: 'Not Sure How Many Times I Have Had Clients Say to Me, "Scott, You Sold Our House."',
    image: "/TravisGabby-20260731.png",
    alt: "Scott sitting in a WildWorks boulder garden",
    variant: "featureSell",
    href: "/pages/I-sell",
    cta: "See How",
  },
];

// Temporarily retire I SELL from the public site while preserving its complete
// card definition and artwork for a future restoration.
const showISellFeature = false;

const wildfireNightImages = [
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

const wildfireLightboxImages = wildfireNightImages;

const processSteps = [
  {
    title: "Background",
    titleLines: ["Background"],
    body: "iScott Collects the Project Idea, Location, Budget Range, Timeline, Photos, and Whether You Need Design, Diagnosis, Contractor Support, or a Full WildWorks Build.",
  },
  {
    title: "Set Appointment",
    titleLines: ["Set Appointment"],
    body: "Scott Follows Up for the Right Next Conversation: a Local Site Visit When Location Allows, or a Zoom Call When the Project is Outside His Local Range.",
  },
  {
    title: "Meeting",
    titleLines: ["Meeting"],
    body: "You Meet with Scott, Either on-Site or Over Zoom, and Discuss Your Needs. Scott Loves to Bounce Ideas Back and Forth. Often in This Meeting, He Can Give You Ballparks for the Work You Need, or Get Them to You Soon After.",
  },
  {
    title: "Designs and Estimates",
    titleLines: ["Designs and", "Estimates"],
    body: "The Strongest Direction Becomes Rapid Design Iteration When a Design is Appropriate. Projects that are Mainly Problem Solving May Not Need a Design; They May Need the Right Fix, Scope, and Estimate.",
  },
  {
    title: "Buildout",
    titleLines: ["Buildout"],
    body: "Whether It is a Fix or an Installation, Once the Direction is Clear, the Work Can Move Through Your Contractor, a Contractor Scott Helps Source, or Scott and WildWorks Directly When the Fit is Right.",
  },
];

const aiWebsiteCapabilities = [
  {
    title: "Avatar Intake",
    titleLines: ["Avatar Intake"],
    body: "Let the Ai Collect Context, Photos, Set Appointments, and Answer Most Questions Automatically.",
    icon: MessageCircle,
  },
  {
    title: "Ai-Native Build",
    titleLines: ["Ai-Native Build"],
    body: "Ai-Native Design, Copy, Media, Automations, and Lead Flow Built in and Around Your Company Brand.",
    icon: Sparkles,
  },
  {
    title: "Human Voice",
    titleLines: ["Human Voice"],
    body: "Human Voice. Your Site Will Be Ai-Driven and Will Feel Like the Real People that Run the Company. Nothing Generic.",
    icon: HomeIcon,
  },
];

type PendingIScottMedia = {
  id: string;
  file: File;
};

function IScottUploadAction({
  placement,
  status,
  onClick,
}: {
  placement: "desktop" | "mobile";
  status: string;
  onClick: () => void;
}) {
  return (
    <div className={`wild-iscott-upload wild-iscott-upload--${placement}`}>
      <button
        type="button"
        className="wild-iscott-upload__button"
        data-testid={`iscott-media-upload-${placement}`}
        onClick={onClick}
      >
        <Images aria-hidden className="wild-iscott-upload__icon" />
        <span>Upload Photos or Videos</span>
      </button>
      {status ? (
        <p className="wild-iscott-upload__status" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function IScottSection({
  variants,
  wakeKey,
  pendingMedia,
  onMediaAccepted,
  onMediaError,
}: {
  variants: Variants;
  wakeKey: number;
  pendingMedia: PendingIScottMedia | null;
  onMediaAccepted: (fileName: string) => void;
  onMediaError: (message: string) => void;
}) {
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center">
      <motion.div
        className="mx-auto flex w-full justify-center px-2 py-3 sm:px-4"
        variants={variants}
      >
        <div className="wild-live-avatar-frame relative aspect-[9/16] w-full max-w-[20rem] min-h-[300px] overflow-hidden rounded-lg">
          <LiveAvatarEmbedInner
            wakeKey={wakeKey}
            pendingMedia={pendingMedia}
            onMediaAccepted={onMediaAccepted}
            onMediaError={onMediaError}
          />
        </div>
      </motion.div>
    </div>
  );
}

function LiveAvatarEmbedInner({
  wakeKey,
  pendingMedia,
  onMediaAccepted,
  onMediaError,
}: {
  wakeKey: number;
  pendingMedia: PendingIScottMedia | null;
  onMediaAccepted: (fileName: string) => void;
  onMediaError: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const shouldMountAvatar = inView || wakeKey > 0;
  const avatarEmbedSrc =
    wakeKey > 0 ? `${LIVE_AVATAR_EMBED_URL}?wake=${wakeKey}` : LIVE_AVATAR_EMBED_URL;

  const sendPendingMedia = useCallback(() => {
    if (!pendingMedia || !iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage(
      {
        type: "wildworks:gallery-upload",
        file: pendingMedia.file,
        uploadId: pendingMedia.id,
      },
      window.location.origin,
    );
  }, [pendingMedia]);

  useEffect(() => {
    const handleAvatarMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "wildworks:gallery-ready") {
        sendPendingMedia();
      } else if (message.type === "wildworks:gallery-accepted" || message.type === "wildworks:gallery-saved") {
        onMediaAccepted(typeof message.fileName === "string" ? message.fileName : "Your Media");
      } else if (message.type === "wildworks:gallery-error") {
        onMediaError(
          typeof message.message === "string"
            ? message.message
            : "iScott Could Not Open That File. Please Try Another Photo or Video.",
        );
      }
    };

    window.addEventListener("message", handleAvatarMessage);
    return () => window.removeEventListener("message", handleAvatarMessage);
  }, [onMediaAccepted, onMediaError, sendPendingMedia]);

  useEffect(() => {
    sendPendingMedia();
  }, [sendPendingMedia]);

  return (
    <div ref={ref} className="absolute inset-0">
      {shouldMountAvatar ? (
        <iframe
          ref={iframeRef}
          key={avatarEmbedSrc}
          src={avatarEmbedSrc}
          title="iScott WildWorks Concierge"
          allow="camera; microphone; autoplay; fullscreen"
          className="absolute inset-0 h-full w-full border-0"
          onLoad={sendPendingMedia}
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0" aria-hidden />
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
  if (line.trim() === "1-877-600-2474") {
    return (
      <a
        className="wild-story-contact-link wild-story-contact-link--phone"
        href="tel:+18776002474"
        aria-label="Call WildWorks at 1-877-600-2474"
        style={storyInlineActionStyle}
      >
        <Phone aria-hidden className="wild-story-contact-icon" />
        <span>Call Now</span>
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
      <span className="wild-story-contact-or">
        <BrandText>{line.slice(0, iScottIndex).trim()}</BrandText>
      </span>
      <a
        className="wild-story-contact-link wild-story-contact-link--iscott"
        href="#talk-to-iscott"
        onClick={onIScottClick}
        aria-label="Talk to iScott"
        style={storyInlineActionStyle}
      >
        <Sparkles aria-hidden className="wild-story-contact-icon" />
        <span>{iScottText}</span>
      </a>
      <BrandText>{line.slice(iScottIndex + iScottText.length)}</BrandText>
    </>
  );
}

function signatureStoryLineClassName(line: string) {
  const normalizedLine = line.trim();

  if (normalizedLine === "1-877-600-2474") {
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
  const [pendingIScottMedia, setPendingIScottMedia] = useState<PendingIScottMedia | null>(null);
const [iScottMediaStatus, setIScottMediaStatus] = useState("");
  const iScottMediaInputRef = useRef<HTMLInputElement>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [callNumberVisible, setCallNumberVisible] = useState(false);
  const handleCallNow = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const hasPhoneDialer = /Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent);
    if (!hasPhoneDialer) {
      event.preventDefault();
    }
    setCallNumberVisible(true);
    try {
      void navigator.clipboard?.writeText("1-877-600-2474").catch(() => undefined);
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

  const openIScottMediaPicker = useCallback(() => {
    iScottMediaInputRef.current?.click();
  }, []);

  const handleIScottMediaChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setIScottMediaStatus("Please Choose a Photo or Video File.");
        return;
      }

      const uploadId = crypto.randomUUID?.() || `${Date.now()}-${file.lastModified}-${file.size}`;
      setIScottMediaStatus(`Saving ${file.name || "Your Media"} Securely for iScott...`);

      try {
        const formData = new FormData();
        formData.append("media", file, file.name || "wildworks-media");
        formData.append("uploadId", uploadId);
        formData.append("anonymousVisitorId", getAnonymousVisitorId());
        formData.append("clientSessionId", getClientSessionId());
        formData.append("route", window.location.pathname);
        formData.append("viewport", `${window.innerWidth}x${window.innerHeight}`);

        const response = await fetch("/api/media/capture", { method: "POST", body: formData });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(result?.error || "iScott Could Not Save That Media Right Now.");
        }

        setPendingIScottMedia({ id: uploadId, file });
        setIScottMediaStatus(`${file.name || "Your Media"} is Saved. Handing It to iScott...`);
        wakeIScottAvatar();
      } catch (error) {
        setPendingIScottMedia(null);
        setIScottMediaStatus(
          error instanceof Error ? error.message : "iScott Could Not Save That Media Right Now.",
        );
      }
    },
    [wakeIScottAvatar],
  );

  const handleIScottMediaAccepted = useCallback((fileName: string) => {
    setPendingIScottMedia(null);
    setIScottMediaStatus(`${fileName} is with iScott. He is Looking at It Now.`);
  }, []);

  const handleIScottMediaError = useCallback((message: string) => {
    setPendingIScottMedia(null);
    setIScottMediaStatus(message);
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
        html:has(#top.wild-home) {
          /* G 2026-08-06: one Home canvas at every width and browser zoom.
             This points directly to the Aug 4 reference palette; the deleted
             legacy gradient was the recurring dirt-brown source. */
          --ww-home-page-background: var(--ww-reference-page) !important;
          background: var(--ww-home-page-background) !important;
          background-attachment: fixed !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
        }

        body:has(#top.wild-home) {
          background: transparent !important;
        }

        body:has(#top.wild-home) .wild-site-backdrop {
          background: var(--ww-home-page-background) !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
        }

        #top.wild-home {
          --ww-box-gradient: var(--ww-reference-card);
          /* The site-wide desktop copper-brown field lives on the fixed body
             canvas so it stays dimensional instead of stretching down Home. */
          --ww-home-night-backdrop: var(--ww-page-background);
          background: transparent !important;
        }

        #top.wild-home .wild-section,
        #top.wild-home #iscott-sales,
        #top.wild-home #what-is-wildworks,
        #top.wild-home #services,
        #top.wild-home #travel-anywhere,
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
          border-color: rgba(246, 211, 154, 0.22) !important;
          background: var(--ww-box-gradient) !important;
          box-shadow:
            0 16px 38px rgba(0, 0, 0, 0.42),
            0 0 30px rgba(224, 168, 90, 0.035),
            inset 0 1px 0 rgba(255, 236, 190, 0.1) !important;
        }

        body #top#top.wild-home #signature-work .wild-story-card--feature {
          --ww-box-gradient:
            radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
            linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
          border-color: #8f3612 !important;
          background:
            radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
            linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
          box-shadow:
            0 18px 42px rgba(53, 17, 4, 0.28),
            inset 0 1px 0 rgba(255, 210, 145, 0.1) !important;
        }

        #top.wild-home .wild-travel-panel {
          position: relative;
          isolation: isolate;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(18rem, 0.72fr);
          gap: clamp(1.4rem, 3.2vw, 3rem);
          max-width: 78rem;
          margin: 0 auto;
          padding: clamp(1.55rem, 3.7vw, 3.7rem);
          overflow: hidden;
          border: 1px solid #8f3612;
          border-radius: 8px;
          background:
            radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
            linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%);
          box-shadow:
            0 18px 42px rgba(53, 17, 4, 0.28),
            inset 0 1px 0 rgba(255, 210, 145, 0.1);
        }

        #top.wild-home .wild-travel-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: none;
        }

        #top.wild-home .wild-travel-copy,
        #top.wild-home .wild-travel-proof {
          min-width: 0;
        }

        #top.wild-home .wild-travel-title {
          margin: 0;
          color: #ffe2ae;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(2.55rem, 5.4vw, 6rem);
          font-weight: 900;
          line-height: 0.9;
          letter-spacing: 0;
          text-shadow:
            0 0.16rem 0.48rem rgba(5, 2, 0, 0.86),
            0 0 1.3rem rgba(115, 48, 11, 0.55);
        }

        #top.wild-home .wild-travel-title span {
          display: block;
        }

        #top.wild-home .wild-travel-title__accent {
          color: #d98b3f;
          -webkit-text-fill-color: #d98b3f;
        }

        #top.wild-home .wild-travel-body {
          max-width: 58rem;
          margin: clamp(1rem, 1.8vw, 1.5rem) 0 0;
          color: #f7d9a5;
          -webkit-text-fill-color: #f7d9a5;
          font-size: clamp(1.02rem, 1.58vw, 1.32rem);
          font-weight: 720;
          line-height: 1.48;
          text-shadow: 0 2px 13px rgba(5, 2, 0, 0.58);
        }

        #top.wild-home .wild-travel-proof {
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(1rem, 2.2vw, 1.6rem);
          border-left: 1px solid rgba(255, 217, 154, 0.26);
        }

        #top.wild-home .wild-travel-icon {
          display: inline-flex;
          width: 3rem;
          height: 3rem;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.9rem;
          border: 1px solid rgba(255, 226, 174, 0.48);
          border-radius: 999px;
          color: #ffe2ae;
          background:
            radial-gradient(circle at 40% 18%, rgba(255, 236, 190, 0.16), transparent 58%),
            linear-gradient(180deg, rgba(63, 66, 66, 0.9), rgba(20, 22, 22, 0.96));
        }

        #top.wild-home .wild-travel-proof__lead {
          margin: 0;
          color: #ffe2ae;
          -webkit-text-fill-color: #ffe2ae;
          font-size: clamp(1.28rem, 2vw, 1.62rem);
          font-weight: 900;
          line-height: 1.08;
          text-shadow: 0 2px 14px rgba(5, 2, 0, 0.55);
        }

        #top.wild-home .wild-travel-proof__copy {
          margin: 0.78rem 0 0;
          color: #f7d9a5;
          -webkit-text-fill-color: #f7d9a5;
          font-size: 0.98rem;
          font-weight: 700;
          line-height: 1.48;
        }

        #top.wild-home .wild-travel-points {
          display: grid;
          gap: 0.52rem;
          margin-top: 1rem;
        }

        #top.wild-home .wild-travel-point {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.5rem;
          color: #f7d9a5;
          -webkit-text-fill-color: #f7d9a5;
          font-size: 0.95rem;
          font-weight: 820;
          line-height: 1.24;
        }

        #top.wild-home .wild-travel-point svg {
          width: 1rem;
          height: 1rem;
          color: #d98b3f;
          -webkit-text-fill-color: #d98b3f;
        }

        #top.wild-home .wild-travel-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.72rem;
          margin-top: 1.15rem;
        }

        #top.wild-home .wild-travel-actions .money-cta {
          min-height: 48px;
          padding: 0.78rem 1rem;
          font-size: 0.98rem;
        }

        @media (max-width: 899px) {
          #top.wild-home .wild-travel-panel {
            grid-template-columns: 1fr;
            padding: clamp(1.25rem, 6vw, 2rem);
          }

          #top.wild-home .wild-travel-title {
            font-size: clamp(2.4rem, 12vw, 4.25rem);
          }

          #top.wild-home .wild-travel-proof {
            padding: 1.05rem 0 0;
            border-left: 0;
            border-top: 1px solid rgba(255, 217, 154, 0.24);
          }

          #top.wild-home .wild-travel-actions {
            flex-direction: column;
          }

          #top.wild-home .wild-travel-actions .money-cta {
            width: 100%;
          }
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
          background: #070809 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 2 !important;
          pointer-events: none !important;
          background:
            linear-gradient(0deg, rgba(7, 2, 0, 0.9) 0%, rgba(10, 3, 1, 0.72) 34%, rgba(17, 6, 1, 0.34) 58%, transparent 82%),
            linear-gradient(90deg, rgba(8, 3, 1, 0.62) 0%, rgba(12, 4, 1, 0.4) 38%, transparent 76%) !important;
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
          width: calc(100% - clamp(1.65rem, 4.8vw, 4.45rem) - clamp(1rem, 4vw, 3rem)) !important;
          min-height: 0 !important;
          padding: 0 clamp(1rem, 4vw, 3rem) clamp(0.75rem, 1.25vw, 1.1rem) clamp(1.65rem, 4.8vw, 4.45rem) !important;
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

        /* G 2026-07-13: two-line I-Sell headline with one continuous light-to-deep-gold treatment. */
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          font-size: clamp(2.3rem, 4.35vw, 4.85rem) !important;
          line-height: 0.88 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line {
          display: block !important;
          width: auto !important;
          max-width: 100% !important;
          white-space: nowrap !important;
          text-wrap: nowrap !important;
          background: var(--ww-display-line-gradient) !important;
          background-image: var(--ww-display-line-gradient) !important;
          background-size: 100% 100% !important;
          background-repeat: no-repeat !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          text-shadow: none !important;
          filter:
            drop-shadow(0 0.12rem 0.12rem rgba(5, 2, 0, 0.72))
            drop-shadow(0 0.42rem 0.8rem rgba(5, 2, 0, 0.42));
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--one {
          background-image: linear-gradient(180deg, #fff6d6 0%, #ffe7b5 52%, #f1c777 100%) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--two {
          font-size: calc(1em - 4pt) !important;
          background-image: linear-gradient(180deg, #f1c777 0%, #df9d52 52%, #b9672f 100%) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-sell-feature-title__period {
          display: inline !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          color: var(--ww-title-1) !important;
          -webkit-text-fill-color: var(--ww-title-1) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
          width: 100% !important;
          max-width: 100% !important;
          margin: clamp(0.8rem, 1.35vw, 1.05rem) 0 0 !important;
          padding: 0 !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          background: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          background-image: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          background-size: 100% 100% !important;
          background-repeat: no-repeat !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          font-size: clamp(1.05rem, 1.68vw, 1.72rem) !important;
          font-weight: 820 !important;
          line-height: 1.18 !important;
          text-align: left !important;
          text-shadow: 0 1px 1px rgba(5, 2, 0, 0.76) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line {
          display: inline !important;
          white-space: nowrap !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          background: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          background-image: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          background-size: 100% 100% !important;
          background-repeat: no-repeat !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line:first-child,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line:last-child {
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          background: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          background-image: linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
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
            display: flex !important;
            flex-direction: column !important;
            aspect-ratio: auto !important;
            min-height: 0 !important;
            height: auto !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell::before {
            background: none !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-bg {
            position: relative !important;
            inset: auto !important;
            z-index: 1 !important;
            width: 100% !important;
            aspect-ratio: 1376 / 768 !important;
            min-height: 0 !important;
            background: #070809 !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-image {
            object-fit: contain !important;
            object-position: center center !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            padding: 1.12rem 1rem 1.28rem !important;
            background:
              linear-gradient(180deg, rgba(24, 26, 27, 0.98) 0%, rgba(6, 7, 8, 0.99) 100%) !important;
            border-top: 1px solid rgba(246, 211, 154, 0.16) !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
            max-width: 100% !important;
            font-size: clamp(1.15rem, 5.7vw, 2.65rem) !important;
            line-height: 0.94 !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            max-width: 100% !important;
            font-size: 1rem !important;
            line-height: 1.28 !important;
            margin-top: 0.72rem !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line {
            white-space: normal !important;
            overflow-wrap: normal !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-cta {
            min-height: 48px !important;
            margin-top: 0.92rem !important;
            padding: 0.82rem 1.1rem !important;
            font-size: 1rem !important;
          }
        }

        @media (min-width: 641px) and (max-width: 899px) {
          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
            padding: 1.45rem 1.5rem 1.65rem !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
            font-size: clamp(2rem, 5vw, 2.65rem) !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            font-size: 1.16rem !important;
          }
        }

        /* G 2026-07-22: remove the black I-Sell shell; leave the photo, copy, and button. */
        #top.wild-home #signature-work .wild-story-card--featureSell {
          position: relative !important;
          display: block !important;
          width: 100% !important;
          aspect-ratio: 1376 / 768 !important;
          min-height: 0 !important;
          height: auto !important;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 8px !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell::before,
        #top.wild-home #signature-work .wild-story-card--featureSell::after {
          content: none !important;
          display: none !important;
          background: none !important;
          box-shadow: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-bg {
          position: absolute !important;
          inset: 0 !important;
          z-index: 1 !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: auto !important;
          min-height: 0 !important;
          overflow: hidden !important;
          border-radius: 0 !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-bg::after {
          content: none !important;
          display: none !important;
          background: none !important;
          box-shadow: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-feature-sell-image {
          object-fit: cover !important;
          object-position: center center !important;
          filter: saturate(1.02) contrast(1.02) brightness(1.02) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
          position: absolute !important;
          inset: 0 !important;
          z-index: 5 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-end !important;
          align-items: flex-start !important;
          box-sizing: border-box !important;
          width: min(70%, 52rem) !important;
          min-height: 0 !important;
          padding: 0 0 clamp(1.35rem, 3.25vw, 3rem) clamp(1.65rem, 4.8vw, 4.45rem) !important;
          border: 0 !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
          max-width: min(100%, 41rem) !important;
          font-size: clamp(2rem, 2.75vw, 3.25rem) !important;
          line-height: 0.9 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
          font-size: clamp(1rem, 1.35vw, 1.45rem) !important;
          line-height: 1.22 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--one {
          background-image: linear-gradient(180deg, #fffaf0 0%, #ffe4ad 54%, #f3c573 100%) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--two {
          background-image: linear-gradient(180deg, #ffedc8 0%, #f8cf87 55%, #e9ad54 100%) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-sell-feature-title__period {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line:first-child,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line:last-child {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          font-weight: 690 !important;
          line-height: 1.38 !important;
          text-shadow: 0 1px 2px rgba(54, 19, 3, 0.62) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof .wild-sell-feature-proof__line {
          white-space: normal !important;
          overflow-wrap: normal !important;
        }

        @media (max-width: 640px) {
          #top.wild-home #signature-work .wild-story-card--featureSell {
            aspect-ratio: 4 / 5 !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
            width: 100% !important;
            padding: 0 1.1rem 1.1rem !important;
            background: transparent !important;
            background-image: none !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
            max-width: min(100%, 24rem) !important;
            font-size: clamp(1.35rem, 6.2vw, 1.6rem) !important;
            line-height: 0.88 !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            margin-top: 0.55rem !important;
            font-size: 0.9rem !important;
            line-height: 1.25 !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-cta {
            min-height: 42px !important;
            margin-top: 0.55rem !important;
            padding: 0.68rem 0.95rem !important;
            font-size: 0.92rem !important;
          }
        }

        @media (min-width: 800px) {
          #top.wild-home #signature-work .wild-story-card--featureSell .wild-story-copy--overlay {
            width: 100% !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            width: 100% !important;
            max-width: none !important;
            font-size: clamp(1.25rem, calc(2vw + 0.25rem), 1.5rem) !important;
            white-space: nowrap !important;
          }

          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof__line {
            display: inline !important;
            white-space: nowrap !important;
          }
        }

        /* Final I-Sell placement lock: keep the CTA anchored while the copy sits fully in the grass. */
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title {
          line-height: 1 !important;
          transform: translateY(0.45rem) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line {
          line-height: 1 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line + .wild-line-title__line {
          margin-top: 0.1em !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
          transform: translateY(0.45rem) !important;
        }

        @media (max-width: 640px) {
          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            font-size: 1.15rem !important;
          }
        }

        @media (min-width: 641px) and (max-width: 899px) {
          #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-proof {
            font-size: 1.41rem !important;
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
          border-color: rgba(255, 226, 174, 0.24) !important;
          background:
            radial-gradient(circle at 42% 18%, rgba(255, 236, 190, 0.14), transparent 58%),
            linear-gradient(180deg, rgba(61, 64, 64, 0.9), rgba(19, 21, 21, 0.96)) !important;
          color: #ffe2ae !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 190, 0.1),
            0 10px 24px rgba(0, 0, 0, 0.3) !important;
        }

        #top.wild-home #iscott-sales #talk-to-iscott.money-panel.wild-iscott-panel {
          border-color: rgba(246, 211, 154, 0.22) !important;
          background: var(--ww-box-gradient) !important;
          box-shadow:
            0 16px 38px rgba(92, 41, 10, 0.28),
            0 0 30px rgba(224, 168, 90, 0.1),
            inset 0 1px 0 rgba(255, 236, 190, 0.1) !important;
        }

        #top.wild-home :is(.money-panel p:not(.money-panel-kicker), .wild-card p, .wild-answer-card p, .wild-story-card p, .wild-process-step p) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home .wild-signup-title {
          color: #ffe2ae !important;
          -webkit-text-fill-color: #ffe2ae !important;
          text-shadow: 0 2px 14px rgba(54, 21, 4, 0.46);
        }

        #top.wild-home .wild-signup-choice {
          border-color: rgba(255, 226, 174, 0.34) !important;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(255, 236, 190, 0.12), transparent 78%),
            linear-gradient(180deg, rgba(58, 61, 61, 0.9), rgba(20, 22, 22, 0.96)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 190, 0.11),
            0 10px 24px rgba(0, 0, 0, 0.3) !important;
        }

        #top.wild-home .wild-signup-field {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home .wild-signup-field input {
          border-color: rgba(247, 217, 165, 0.62) !important;
          background:
            linear-gradient(180deg, rgba(232, 182, 109, 0.34), rgba(200, 121, 54, 0.2)) !important;
          color: var(--ww-dark-text) !important;
          -webkit-text-fill-color: var(--ww-dark-text) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 236, 190, 0.32),
            0 8px 20px rgba(86, 34, 8, 0.18) !important;
        }

        #top.wild-home .wild-signup-field input::placeholder {
          color: rgba(59, 24, 8, 0.72) !important;
          -webkit-text-fill-color: rgba(59, 24, 8, 0.72) !important;
        }

        /* G 2026-07-22: use the Home consent-copy typeface across the entire Home page. */
        #top#top.wild-home,
        #top#top.wild-home * {
          font-family: var(--ww-body-copy-font) !important;
        }

        /* Permanent WildWorks three-color key from the three Ruins headline lines.
           Keep the sell title solid: Color 1 #f7d9a5 / Color 2 #e8b66d / Color 3 #d2934a. */
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--one,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--two,
        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-sell-feature-title__period {
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 0.1rem 0.28rem rgba(42, 14, 3, 0.68) !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--one {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-line-title__line.wild-sell-feature-title__line--two {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
        }

        #top.wild-home #signature-work .wild-story-card--featureSell .wild-sell-feature-title .wild-sell-feature-title__period {
          display: inline !important;
          color: #d2934a !important;
          -webkit-text-fill-color: #d2934a !important;
        }

        /* Home-only type lift: luminous warm ivory for reading, soft gold for
           hierarchy, and one restrained dark edge. The Ruins and Sell 1/2/3
           systems remain deliberately exempt. */
        #top.wild-home :is(.wild-body, .wild-different-copy, .wild-ai-mission, .wild-travel-body, .wild-travel-proof__copy, .wild-story-card p, .wild-card p, .wild-answer-card p, .wild-process-step p, .wild-signup-copy, .wild-footer-legal-link) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 1px 2px rgba(57, 20, 3, 0.46) !important;
        }

        #top.wild-home :is(.wild-kicker, .money-panel-kicker, .wild-process-kicker, .wild-travel-kicker, .wild-signup-eyebrow) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background-image: none !important;
          text-shadow: 0 1px 2px rgba(57, 20, 3, 0.42) !important;
        }

        #top.wild-home :is(.wild-section-title, .wild-card h3, .wild-project-card h3, .wild-answer-card h3, .wild-process-step h3):not(.wild-signature-title):not(.wild-sell-feature-title) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 0.08em 0.22em rgba(57, 20, 3, 0.5) !important;
        }

        #top.wild-home .wild-section-title:not(.wild-signature-title):not(.wild-sell-feature-title) .wild-line-title__line {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 0.08em 0.22em rgba(57, 20, 3, 0.5) !important;
        }

        #top.wild-home #wildworks-proof .wild-section-title {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 0.08em 0.2em rgba(57, 20, 3, 0.42) !important;
        }

        #top.wild-home #wildworks-proof .wild-tree-title .wild-line-title__line--one {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home #wildworks-proof .wild-tree-title .wild-line-title__line--two {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
        }

        #top.wild-home #wildworks-proof .wild-tree-title .wild-line-title__line--three {
          color: #d2934a !important;
          -webkit-text-fill-color: #d2934a !important;
        }

        /* iPad portrait: match the Tree of Life display scale to the Ruins
           headline below it while preserving the intentional left alignment. */
        @media (min-width: 720px) and (max-width: 1100px) and (orientation: portrait) {
          body #top#top.wild-home #wildworks-proof .wild-tree-title {
            font-size: clamp(3.15rem, 5.2vw, 3.4rem) !important;
            line-height: 0.95 !important;
            text-align: left !important;
          }
        }

        /* Tighten the transition from the Ruins card into Services without
           changing spacing inside either section. */
        #top.wild-home #signature-work {
          padding-bottom: clamp(1.5rem, 3vw, 2.75rem) !important;
        }

        /* Services keeps its glass cards while the shared desktop backdrop
           remains continuous behind them. */
        #top.wild-home #services {
          padding-top: clamp(2rem, 4vw, 3.5rem) !important;
          background: transparent !important;
          background-color: transparent !important;
        }

        /* Services use the approved screenshot statement material and brand type. */
        #top.wild-home #services .wild-card {
          border-color: #8f3612 !important;
          background:
            radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
            linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
          box-shadow:
            0 18px 42px rgba(53, 17, 4, 0.28),
            inset 0 1px 0 rgba(255, 210, 145, 0.1) !important;
        }

        #top.wild-home #services .wild-card-icon {
          border-color: rgba(255, 239, 202, 0.5) !important;
          background:
            radial-gradient(ellipse at 22% 4%, rgba(255, 220, 160, 0.12), transparent 48%),
            linear-gradient(145deg, rgba(199, 104, 48, 0.95), rgba(183, 91, 40, 0.98)) !important;
          color: #f7d9a5 !important;
          box-shadow: inset 0 1px 0 rgba(255, 243, 213, 0.18) !important;
        }

        #top.wild-home #services .wild-card h3,
        #top.wild-home #services .wild-card h3 .wild-line-title__line {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          font-size: clamp(1.05rem, 1.3vw, 1.28rem) !important;
          font-weight: 600 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 1px 2px rgba(40, 12, 2, 0.35) !important;
        }

        #top.wild-home #services .wild-card p,
        #top.wild-home #services .wild-card p :is(strong, em, i, span) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          font-size: clamp(0.88rem, 1.02vw, 0.96rem) !important;
          font-weight: 500 !important;
          line-height: 1.48 !important;
          opacity: 1 !important;
          text-shadow: 0 1px 1px rgba(40, 12, 2, 0.28) !important;
        }

        /* The Home project stories use discrete brand colors by phrase/line,
           never a vertical blend inside individual letterforms. */
        #top.wild-home :is(.ww-c1, .wild-story-card .ww-c1) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }
        #top.wild-home :is(.ww-c2, .wild-story-card .ww-c2) {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
        }
        #top.wild-home :is(.ww-c3, .wild-story-card .ww-c3) {
          color: #c87936 !important;
          -webkit-text-fill-color: #c87936 !important;
        }
        #top.wild-home :is(.ww-c1, .ww-c2, .ww-c3, .wild-story-card p, .wild-story-card h2, .wild-story-card h3, .wild-story-card .wild-line-title__line) {
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 1px 2px rgba(57, 20, 3, 0.5) !important;
        }

        #top.wild-home :is(.wild-nav a, .wild-nav button, .wild-brand-subtitle, .wild-footer-quote, .wild-footer-attribution, .wild-utility-label) {
          color: #f1c777 !important;
          -webkit-text-fill-color: #f1c777 !important;
          text-shadow: 0 1px 2px rgba(57, 20, 3, 0.42) !important;
        }

        /* Services heading: G's permanent 1 / 2 / 3 color sequence. */
        #top.wild-home #services > .wild-section-heading > .wild-kicker {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
        }

        #top.wild-home #services > .wild-section-heading > .wild-section-title .wild-line-title__line {
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
        }

        #top.wild-home #services > .wild-section-heading > .wild-section-title .wild-line-title__line:nth-child(1) {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
        }

        #top.wild-home #services > .wild-section-heading > .wild-section-title .wild-line-title__line:nth-child(2) {
          color: #d2934a !important;
          -webkit-text-fill-color: #d2934a !important;
        }

        /* Project Wildfire heading lock: the two lines use the permanent
           WildWorks Color 1 / Color 2 hierarchy with no muddy gradient. */
        #top#top.wild-home #project-wildfire .wild-wildfire-flame-title__text {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          filter: none !important;
          text-shadow: 0 0.1rem 0.24rem rgba(67, 25, 5, 0.52) !important;
        }

        #top#top.wild-home #project-wildfire .wild-wildfire-title .wild-line-title__line {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 0.08rem 0.2rem rgba(67, 25, 5, 0.44) !important;
        }

        /* G 2026-08-06: the photographed-build statement is a deliberate
           centered taper: longest first line, medium second, shortest close. */
        #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line {
          width: fit-content;
          max-width: 100%;
          margin-inline: auto;
          white-space: nowrap !important;
        }

        @media (min-width: 720px) and (max-width: 1100px) and (orientation: portrait) {
          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--lead {
            font-size: 1.95rem !important;
          }

          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--middle {
            font-size: 2.05rem !important;
          }

          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--close {
            font-size: 2.15rem !important;
          }
        }

        @media (max-width: 719px) {
          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--lead {
            font-size: clamp(0.98rem, 4.3vw, 1.15rem) !important;
          }

          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--middle {
            font-size: clamp(1.05rem, 4.8vw, 1.3rem) !important;
          }

          #top#top.wild-home #project-wildfire .wild-wildfire-build-note__line--close {
            font-size: clamp(1.12rem, 5.4vw, 1.42rem) !important;
          }
        }

        /* Reusable framed eyebrow: reserved for short, centered section labels. */
        #top#top.wild-home .wild-kicker.wild-kicker--framed,
        #top#top.wild-home .wild-kicker-frame {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          justify-content: center;
          margin: 0 auto clamp(1rem, 1.8vw, 1.35rem);
          padding: clamp(0.52rem, 0.9vw, 0.68rem) clamp(0.88rem, 1.7vw, 1.22rem);
          border: 1px solid #e8b66d;
          border-radius: 7px;
          background: #d2934a !important;
          background-image: none !important;
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          text-shadow: 0 1px 0 rgba(91, 39, 10, 0.56) !important;
          box-shadow:
            0 12px 28px rgba(116, 52, 15, 0.24),
            inset 0 1px 0 rgba(247, 217, 165, 0.3),
            inset 0 -1px 0 rgba(112, 50, 15, 0.24);
        }

        #top.wild-home #ai-websites .wild-site-offer-heading > .wild-section-title .wild-line-title__line {
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-heading > .wild-section-title .wild-line-title__line:nth-child(1) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-heading > .wild-section-title .wild-line-title__line:nth-child(2) {
          color: #e8b66d !important;
          -webkit-text-fill-color: #e8b66d !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-heading > .wild-body {
          width: min(100%, 52rem) !important;
          max-width: 52rem !important;
          margin-inline: auto !important;
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          line-height: 1.55 !important;
          text-align: center !important;
          text-align-last: center !important;
          text-wrap: pretty !important;
        }

        /* AI capability cards share one readable hierarchy: heading and icon 1,
           copy 2. Color 3 does not have enough contrast on the copper cards. */
        @media (min-width: 720px) and (max-width: 899px) {
          body #top#top.wild-home #ai-websites .wild-site-offer-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            width: min(68%, 36rem) !important;
            max-width: 36rem !important;
            margin-inline: auto !important;
          }

          body #top#top.wild-home #ai-websites .wild-site-offer-card {
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            padding: 1.2rem 1.3rem !important;
          }
        }

        #top.wild-home #ai-websites .wild-site-offer-card {
          border-color: #8f3612 !important;
          background:
            radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
            linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
          box-shadow:
            0 18px 42px rgba(53, 17, 4, 0.28),
            inset 0 1px 0 rgba(255, 210, 145, 0.1) !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-card .wild-card-icon {
          border-color: rgba(232, 182, 109, 0.82) !important;
          background: rgba(100, 43, 16, 0.44) !important;
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          box-shadow:
            inset 0 1px 0 rgba(247, 217, 165, 0.28),
            0 6px 18px rgba(74, 30, 8, 0.18) !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-card :is(h3, h3 .wild-line-title__line) {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-card p {
          color: #f7d9a5 !important;
          -webkit-text-fill-color: #f7d9a5 !important;
          background: none !important;
          background-image: none !important;
          -webkit-background-clip: border-box !important;
          background-clip: border-box !important;
        }

        #top.wild-home #ai-websites .wild-site-offer-card .wild-card-icon svg {
          color: #f7d9a5 !important;
          stroke: #f7d9a5 !important;
          stroke-width: 2.35 !important;
        }

        /* Footer actions match the approved Upload Photos or Videos control:
           luminous gold material with dark, readable ink. */
        #top.wild-home #footer :is(
            .wild-signup-choice-button,
            .wild-signup-choice-button span,
            .wild-signup-choice-button svg,
            .wild-signup-submit,
            .wild-signup-submit span,
            .wild-signup-submit svg
          ) {
          color: var(--ww-dark-text) !important;
          -webkit-text-fill-color: var(--ww-dark-text) !important;
          text-shadow: 0 1px 0 rgba(255, 238, 196, 0.58) !important;
        }

        #top.wild-home #footer :is(.wild-signup-choice-button, .wild-signup-submit) {
          border-color: rgba(255, 226, 174, 0.72) !important;
          background: var(--ww-button-gradient) !important;
          background-image: var(--ww-button-gradient) !important;
          font-family: "Goudy Old Style", "Baskerville Old Face", Garamond, var(--font-serif), Georgia, serif !important;
          font-weight: 760 !important;
          letter-spacing: 0.015em !important;
          box-shadow:
            0 16px 42px rgba(20, 7, 1, 0.42),
            0 0 24px rgba(224, 168, 90, 0.18),
            inset 0 1px 0 rgba(255, 247, 218, 0.78),
            inset 0 -1px 0 rgba(72, 28, 6, 0.46) !important;
        }

        #top.wild-home #footer .wild-signup-submit {
          min-height: 64px !important;
          font-size: clamp(1.18rem, 1.8vw, 1.5rem) !important;
        }

        body #top#top.wild-home .wild-hero.discordSection
          .wild-hero-lede-line:nth-child(2) {
          margin-top: 0.16em !important;
        }

        /* Project Wildfire lightbox: bright copper-orange display field on
           every device, without the old muddy brown surround. */
        body:has(#top.wild-home) .wildfire-lightbox {
          background:
            radial-gradient(ellipse 118% 82% at 50% 18%, rgba(255, 211, 139, 0.18) 0%, rgba(255, 154, 72, 0.08) 46%, transparent 72%),
            linear-gradient(90deg, #984019 0%, #aa4d21 22%, #ba5b2b 50%, #aa4d21 78%, #984019 100%) !important;
        }

        body:has(#top.wild-home) .wildfire-lightbox-bar {
          border-color: rgba(255, 222, 163, 0.58) !important;
          background:
            radial-gradient(ellipse at 24% 0%, rgba(255, 226, 171, 0.2), transparent 58%),
            linear-gradient(105deg, #c6753f 0%, #b45b2c 54%, #a3471e 100%) !important;
          box-shadow:
            0 12px 28px rgba(91, 35, 8, 0.24),
            inset 0 1px 0 rgba(255, 239, 201, 0.28) !important;
        }

        body:has(#top.wild-home) .wildfire-lightbox-image {
          border-color: rgba(255, 218, 151, 0.5) !important;
          background:
            radial-gradient(ellipse 96% 60% at 50% 18%, rgba(255, 204, 130, 0.16), transparent 68%),
            linear-gradient(90deg, #9e431c 0%, #b25729 26%, #bd612f 50%, #b25729 74%, #9e431c 100%) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 229, 176, 0.2),
              0 18px 42px rgba(91, 35, 8, 0.24) !important;
        }

        /* G 2026-08-07: every Home viewport shares the approved desktop pair.
           Do not reintroduce a phone-only red/orange compensation: it made the
           same page look painfully hot on a real phone. */
        @media (max-width: 1536px) {
          html:has(#top.wild-home) {
            --ww-reference-a: #983e17 !important;
            --ww-reference-b: #c85a24 !important;
            --ww-reference-page: #983e17 !important;
            --ww-reference-mobile-page: #983e17 !important;
            --ww-reference-card: #c85a24 !important;
            --ww-home-page-background: var(--ww-reference-page) !important;
            background: var(--ww-home-page-background) !important;
          }

          body:has(#top.wild-home) .wild-site-backdrop {
            background: var(--ww-reference-page) !important;
            background-color: #983e17 !important;
          }
        }

        @media (min-width: 720px) and (max-width: 1365px) {
          body #top#top.wild-home #signature-work .wild-story-card--feature {
            background:
              radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
              linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
          }
        }

        /* Phone hero: the copy and actions live directly on the universal
           homepage canvas. Keep the approved gold button material, but remove
           the broad exterior shadows that visually joined into a dark card. */
        @media (max-width: 719px) {
          body #top#top.wild-home #project-wildfire
            :is(.wild-wildfire-photo, .wild-wildfire-inspiration-card) {
            box-shadow:
              inset 0 1px 0 rgba(255, 237, 197, 0.28),
              0 4px 10px rgba(123, 47, 12, 0.1) !important;
          }

          body #top#top.wild-home .wild-hero.discordSection,
          body #top#top.wild-home .wild-hero.discordSection .wild-hero-copy,
          body #top#top.wild-home .wild-hero.discordSection .wild-cta-row,
          body #top#top.wild-home .wild-hero.discordSection .wild-cta-row > span {
            border-color: transparent !important;
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          body #top#top.wild-home .wild-hero.discordSection .wild-hero-copy::before,
          body #top#top.wild-home .wild-hero.discordSection .wild-hero-copy::after,
          body #top#top.wild-home .wild-hero.discordSection .wild-cta-row::before,
          body #top#top.wild-home .wild-hero.discordSection .wild-cta-row::after {
            content: none !important;
            display: none !important;
          }

          body #top#top.wild-home .wild-hero.discordSection .wild-cta-row .money-cta {
            box-shadow:
              inset 0 1px 0 rgba(255, 247, 218, 0.78),
              inset 0 -1px 0 rgba(72, 28, 6, 0.46) !important;
          }
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
            src="/wildworks-home-banner-20260726.png"
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
                color: "#f7d9a5",
                WebkitTextFillColor: "#f7d9a5",
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
              style={{ color: "#e8b66d", WebkitTextFillColor: "#e8b66d" }}
            >
              Makes Your Home
            </span>
            <span
              className="wild-hero-headline__line wild-hero-headline__line--irresistible"
              style={{
                color: "#c87936",
                WebkitTextFillColor: "#c87936",
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
              lineHeight: 1.36,
            }}
          >
            <span className="wild-hero-lede-line">
              By Creating <span className="wild-hero-lede-accent">Exquisite Works of Art</span>
            </span>
            <span className="wild-hero-lede-line wild-hero-lede-line--problems">
              And Solving Your Real World Problems
            </span>
            <span className="wild-hero-lede-line wild-hero-lede-line--italic">
              Anywhere on Planet Earth
            </span>
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
                href="tel:+18776002474"
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
                  href="tel:+18776002474"
                  onClick={handleCallNow}
                  aria-label="Call Now"
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
                  {phoneCopied ? "Number Copied" : "Call Now"}
                </motion.a>
              ) : null}
            </span>
          </motion.div>
        </motion.div>
      </motion.section>

      <PhoneNumberLine className="wild-phone-number-line--home-hero" />

      <motion.section
        id="iscott-sales"
        className="wild-section wild-section--intro discordSection discordSection--1"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <style>{`
          body #top#top.wild-home #iscott-sales #talk-to-iscott.money-panel.wild-iscott-panel {
            border: 1px solid #8f3612 !important;
            background:
              radial-gradient(ellipse 115% 90% at 50% 3%, rgba(232, 182, 109, 0.11), transparent 62%),
              linear-gradient(180deg, rgba(190, 88, 36, 0.94) 0%, rgba(169, 68, 25, 0.97) 100%) !important;
            background-color: #a94419 !important;
            box-shadow:
              0 18px 42px rgba(53, 17, 4, 0.28),
              inset 0 1px 0 rgba(255, 210, 145, 0.1) !important;
          }

          body #top#top.wild-home :is(
            #signature-work .wild-story-card--feature,
            #services .wild-card,
            #wildworks-ai .wild-ai-card,
            #ai-websites .wild-site-offer-card
          ),
          body footer.discordSection .wild-footer-contact-cta {
            border: 1px solid #8f3612 !important;
            background: #c85a24 !important;
            background-image: none !important;
            background-color: #c85a24 !important;
            box-shadow:
              0 18px 42px rgba(53, 17, 4, 0.28),
              inset 0 1px 0 rgba(255, 210, 145, 0.1) !important;
          }

          #talk-to-iscott > .wild-iscott-disclosure {
            color: #f7d9a5 !important;
            -webkit-text-fill-color: #f7d9a5 !important;
            background: none !important;
            text-shadow: 0 1px 3px rgba(92, 39, 8, 0.42) !important;
          }
        `}</style>
        <input
          ref={iScottMediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="wild-iscott-upload__input"
          onChange={handleIScottMediaChange}
          tabIndex={-1}
          aria-hidden="true"
        />
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
              className="wild-body wild-iscott-body wild-iscott-body--color-one"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              Start with iScott, Scott&apos;s digital twin. Talk to him like you
              would the real Scott. Tell him your goals, timing, dream projects,
              and any home and garden problems you have.
            </motion.p>
            <motion.p
              className="wild-body wild-iscott-body wild-iscott-body--color-one"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              Show him your space using the Upload Photos or Videos button.
              Describe what you want, and he will organize the details for the
              real Scott. This helps Scott have context for when your first
              conversation begins.
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
              className="wild-body wild-iscott-body wild-iscott-body--color-one"
              variants={fadeInRight}
              style={noWhiteTextStyle}
            >
              iScott gathers, discusses, gathers information, and hands off. He
              does not replace Scott. He briefs the real Scott so your first
              conversation starts with understanding.
            </motion.p>
            <motion.div variants={fadeInUp}>
              <IScottUploadAction
                placement="desktop"
                status={iScottMediaStatus}
                onClick={openIScottMediaPicker}
              />
            </motion.div>
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
            <IScottSection
              variants={softScaleIn}
              wakeKey={avatarWakeKey}
              pendingMedia={pendingIScottMedia}
              onMediaAccepted={handleIScottMediaAccepted}
              onMediaError={handleIScottMediaError}
            />
            <IScottUploadAction
              placement="mobile"
              status={iScottMediaStatus}
              onClick={openIScottMediaPicker}
            />
            <p className="wild-iscott-disclosure mt-3 text-center text-xs font-semibold leading-relaxed">
              By talking to iScott or uploading media, you agree WildWorks may
              save the conversation and media to organize your inquiry and
              follow up. Do not share sensitive personal, legal, medical, or
              child information. See{" "}
              <Link href="/pages/privacy-policy" className="underline decoration-[#e8b66d] underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
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
            <motion.p className="wild-kicker wild-kicker--framed" variants={fadeInLeft} style={noWhiteKickerStyle}>
              <BrandText>What is WildWorks?</BrandText>
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["WildWorks is", "Two Things."]} />
            </motion.h2>
            <motion.p className="wild-body wild-body--center" variants={fadeInRight} style={noWhiteTextStyle}>
              <BrandText>
              It is Scott&apos;s Real-World Eye for Property, Stone, Terrain, and
              Problem Solving. And It is WildWorks.Ai, Built to Make That Eye
              Available Earlier, Farther Away, and with Less Wasted Motion.
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
              aria-label={'What does it mean, to "Live Like a King?"'}
              variants={softScaleIn}
              style={{ marginTop: 0 }}
            >
              <LineTitle lines={["What Does It Mean, to", "\"Live Like a King?\""]} />
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
              State-of-the-Art Ai for Everyone on Earth.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              <BrandText>
              Right Now, Scott is Hands on Building WildWorks.Ai Beta Himself,
              Using His Taste, His Judgment, His 40+ Years of Design Experience,
              and Incorporating Ai Agents to Study His Protocols So They Can
              Eventually Carry the Entire Workload. When This Scales,
              WildWorks.Ai Will Be Able to Bring the Most Exquisitely Beautiful
              Designs to Anyone on Earth at a Price Point That Will Continuously
              Move Towards Zero.
              </BrandText>
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              That is What Scott Wants: Everyone on Earth Surrounded By the
                World&apos;s Most Beautiful Things. That is What &quot;Live Like a King&quot;
              Means.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Scott is Regarded as One of the Finest Landscape Designers in the
              World. Right Now, He is at the Peak of His Career, and Bolting Ai
              Design Onto His System is Turbocharging His Design Abilities.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Who Can He Help? The Range is Everything from Literal Zero-Budget
              DIY Design Help for People Using Materials Already on Site and
              Doing All the Labor Themselves, Through Every Kind of Project in
              Between: Design Only, Help Finding a Contractor in Your Area,
              Remote Oversight from Afar, or Full Hands on Design Build and
              Problem Solving for Lifestyles of the Rich and Famous Level
              Projects Where Scott is on Site and Overseeing the Work Himself,
              Personally.
            </motion.p>
            <motion.p className="wild-body wild-ai-mission" variants={fadeInRight} style={noWhiteTextStyle}>
              Everything is on the Table. Scott Will Help You in Every Way He
              Can Personally, and iScott Will Be There in the Future to Help You
              in Every Way Imaginable.
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
              Using Ai is Not Replacing Human Intelligence and Creativity, It is
              Turbocharging It. Scott Still Uses His Natural Experience and
              Abilities, But is Able to Produce Great Designs 100x Faster Than
              with a Pencil and Paper, or Traditional Computer Aided Design,
              Plus, Ai Opens a Whole New World of Design Ideas That Scott Would
              Have Never Dreamed of. It is Just All Around Wonderful.
            </p>
            <p>
              <BrandText>
              iScott Collects the Details and Confirms How to Reach You, Then
              Hands the Project to Scott. Scott Reviews the Area, Gets Back to
              You with Questions and Comments, and Uses 40+ Years of Practical
              Judgement, Taste, Engineering Sense, and Ai Assisted Design to Give
              You an Exquisitely Beautiful Design, a Useful Fix, or the Clearest
              Next Step. In Beta, You Work Directly with Scott While WildWorks.Ai
              Becomes the System You Help Build.
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
                Scott Designed the Outdoor Fireplace. When He Went Searching for
                Ideas for an Outdoor Lounge, He Came Across the First Image, Which
                Led Him Next to the Patio Image. As You Can See, Though They Were
                Images, He Was Looking for Real Things. They Ended Up Being Ai
                Images. A Dead Giveaway is One Post on the Outdoor Lounge That Would
                Never Exist in Reality.
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
            aria-label="Then Came the Patio. Then Came the Lounge. Then We Just Kept Going."
          >
            <span className="wild-wildfire-sequence-callout__line wild-wildfire-sequence-callout__line--patio">
              Then Came the Patio.
            </span>
            <span className="wild-wildfire-sequence-callout__line wild-wildfire-sequence-callout__line--lounge">
              Then Came the Lounge.
            </span>
            <span className="wild-wildfire-sequence-callout__line wild-wildfire-sequence-callout__line--going">
              Then We Just Kept Going.
            </span>
          </motion.div>

          <motion.div className="wild-wildfire-build-note" variants={fadeInUp}>
            <span className="wild-wildfire-build-note__line wild-wildfire-build-note__line--lead">
              We Photographed Every Step of the
            </span>
            <span className="wild-wildfire-build-note__line wild-wildfire-build-note__line--middle">
              Build, from pre-Breaking Ground
            </span>
            <span className="wild-wildfire-build-note__line wild-wildfire-build-note__line--close">
              Through the First Wood Fire.
            </span>
          </motion.div>

          <motion.div className="wild-cta-row wild-cta-row--center" variants={fadeInUp} style={{ marginTop: "-1.5rem" }}>
            <Link href="/pages/Wildfire" className="money-cta money-cta--primary">
              <Flame aria-hidden className="h-5 w-5" />
              <span>Check Out Project Wildfire</span>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {activeWildfireImage && typeof document !== "undefined" ? createPortal(
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
        </div>,
        document.body,
      ) : null}

      <motion.section
        className="wild-home-statement discordSection"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <motion.h2
          className="wild-home-statement__title"
          variants={softScaleIn}
          aria-label="Design at the Limits of Human Imagination. A Contractor that Faithfully Brings Those Designs to Life. Wild Works. Where Fine Art Meets the Wild"
        >
          <span className="wild-home-statement__line wild-home-statement__line--one">
            <span className="wild-home-statement__phrase">Design at the Limits</span>{" "}
            <span className="wild-home-statement__phrase">of Human Imagination.</span>
          </span>
          <span className="wild-home-statement__line wild-home-statement__line--two">
            <span className="wild-home-statement__phrase">A Contractor that Faithfully</span>{" "}
            <span className="wild-home-statement__phrase">Brings Those Designs to Life.</span>
          </span>
          <span className="wild-home-statement__brand-lockup" aria-hidden="true" />
          <span className="wild-home-statement__line wild-home-statement__line--four">
            Where Fine Art Meets the Wild
          </span>
        </motion.h2>
      </motion.section>

      <PhoneNumberLine
        className="wild-phone-number-line--home-tree"
        showCallToday={false}
      />

      <motion.section
        id="wildworks-proof"
        className="wild-section discordSection discordSection--3"
        variants={slowStagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-split">
          <figure className="wild-home-proof-figure">
            <ProjectImage
              src="/ww-art-tree-of-life.jpeg"
              alt="Tree of Life natural stone patio concept with creeping perennial leaves"
              sizes="(max-width: 900px) 100vw, 48vw"
              direction="left"
            />
            <figcaption className="wild-home-hero-stonework-note wild-home-image-stonework-note">
              {STONEWORK_AUTHENTICITY_LINE}
            </figcaption>
          </figure>
          <div className="wild-copy-stack">
            <motion.h2 className="wild-section-title wild-line-title wild-tree-title" variants={softScaleIn}>
              <LineTitle lines={["The Tree of", "Life Natural", "Stone Patio"]} />
            </motion.h2>
            <motion.p className="wild-body" variants={fadeInRight} style={noWhiteBlendTextStyle}>
              An Artsy Young Couple of Irish Descent in Mount Washington, Baltimore City,
              Wanted a Natural Stone Patio. I had Always Been Fascinated by the
              Celtic Tree of Life, so I Asked What They Thought about Building
              One in Their Back Yard. They Loved the Idea, and I am Still
              Grateful They Let Us Build This Work of Art.
            </motion.p>
            <motion.p className="wild-body" variants={fadeInRight} style={noWhiteBlendTextStyle}>
              The People I Love Working with Look at a Space and Ask, “What’s the
              Coolest Thing We Could Do Here?” They Want Something Rare,
              Extraordinary, and Impossible to Find Anywhere Else.
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
            aria-label="What Could Be Cooler Than Having A Ruin Of Your Own?"
          >
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__one">What Could</span>
            </span>
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__one">Be Cooler</span>
            </span>
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__two">Than Having</span>
            </span>
            <span className="wild-signature-title__line">
            <span className="wild-signature-title__two">A Ruin</span>
            </span>
            <span className="wild-signature-title__line">
              <span className="wild-signature-title__three">Of Your Own?</span>
            </span>
          </motion.h2>
        </div>

        <div className="wild-story-list">
          {signatureWork
            .filter((project) => showISellFeature || project.variant !== "featureSell")
            .map((project, index) => (
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
                  <Link
                    href={project.href}
                    className="wild-story-card-link"
                    aria-label={`Explore ${project.title}`}
                  />
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
                        "0 0 clamp(0.75rem, 1.25vw, 1.1rem) clamp(1.65rem, 4.8vw, 4.45rem)",
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
                          {lineIndex === 1 && line.endsWith("Period.") ? (
                            <>
                              {line.slice(0, -"Period.".length)}
                              <span className="wild-sell-feature-title__period">Period.</span>
                            </>
                          ) : (
                            line
                          )}
                        </span>
                      ))}
                    </h3>
                    <p
                      className="wild-sell-feature-proof"
                      style={{
                        position: "static",
                        maxWidth: "min(100%, 43rem)",
                        margin: "clamp(0.8rem, 1.35vw, 1.05rem) 0 0",
                        color: "transparent",
                        WebkitTextFillColor: "transparent",
                        backgroundImage:
                          "linear-gradient(180deg, #fffbed 0%, #ffe7b5 48%, #e8b66d 75%, #d2934a 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        fontSize: "clamp(1.42rem, 2.05vw, 2.15rem)",
                        fontWeight: 820,
                        lineHeight: 1.18,
                        pointerEvents: "none",
                        textShadow: "0 1px 1px rgba(5, 2, 0, 0.76)",
                      }}
                    >
                      {String(project.body)
                        .split("\n")
                        .map((line) => (
                          <span key={line} className="wild-sell-feature-proof__line">
                            {line}
                          </span>
                        ))}
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
                  <Link
                    href={project.href}
                    className="wild-story-media-link"
                    aria-label={`Explore ${project.title}`}
                  >
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
                  </Link>
                  <div className="wild-story-copy">
                    <h3 className="wild-line-title">
                      <LineTitle lines={project.titleLines} />
                    </h3>
                    {Array.isArray(project.body) ? (
                      project.body.map((paragraph, i) => (
                        <p key={paragraph} className="ww-c1">
                          {(i === 2 ? [paragraph.split("\n")[0]] : paragraph.split("\n")).map((line, j) => (
                            <Fragment key={j}>
                              {j > 0 ? <br /> : null}
                              <span className={signatureStoryLineClassName(line)}>
                                {project.variant === "feature" && i === 2
                                  ? <BrandText>{line}</BrandText>
                                  : renderSignatureStoryLine(line, handleIScottCtaClick)}
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
                    {project.variant !== "feature" && project.href ? (
                      <Link
                        href={project.href}
                        className="wild-inline-link"
                      >
                        {project.cta}
                      </Link>
                    ) : null}
                  </div>
                  {project.variant === "feature" ? (
                    <div className="wild-story-actions" aria-label="The Ruins actions">
                      <a
                        href="#talk-to-iscott"
                        className="money-cta money-cta--primary wild-story-action"
                        onClick={handleIScottCtaClick}
                      >
                        <Sparkles aria-hidden className="wild-story-action-icon" />
                        <span>Talk to iScott</span>
                      </a>
                      <a
                        href="tel:+18776002474"
                        className="money-cta money-cta--primary wild-story-action"
                        aria-label="Call Now"
                      >
                        <Phone aria-hidden className="wild-story-action-icon" />
                        <span>Call Now</span>
                      </a>
                      <Link
                        href={project.href}
                        className="money-cta money-cta--primary wild-story-action"
                      >
                        <Compass aria-hidden className="wild-story-action-icon" />
                        <span>{project.cta}</span>
                      </Link>
                    </div>
                  ) : null}
                </>
              )}
            </motion.article>
            ))}
        </div>
      </motion.section>

      <PhoneNumberLine
        className="wild-phone-number-line--home-services"
        showCallToday={false}
      />

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
            <span className="wild-kicker-frame">Services</span>
          </motion.p>
          <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
            <LineTitle lines={["What WildWorks", "is Known for:"]} />
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
                  {service.body.map((paragraph, paragraphIndex) => (
                    <p key={`${service.title}-${paragraphIndex}`}>
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
              className="wild-kicker wild-process-kicker wild-kicker--framed"
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
            <motion.p className="wild-kicker wild-preserve-ai-case wild-kicker--framed" variants={fadeInLeft}>
              Bottom Line
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title wild-different-title" variants={softScaleIn}>
              <LineTitle lines={["What Makes", "WildWorks.Ai Different?"]} />
            </motion.h2>
            <motion.div className="wild-different-copy" variants={fadeInRight}>
              <p>
                <BrandText>
                WildWorks.Ai is Different Because the System Being Built is Not
                Just Software. It is Scott&apos;s 40+ Years of Design Experience,
                His Talent, His Creative Instincts, His Practical Building
                Knowledge, and His Use of State-of-the-Art Technology All Being
                Brought Together Into One System.
                </BrandText>
              </p>
              <p>
                The Goal is to Give People Anywhere on Earth Designs as Beautiful
                as Anything They Could Receive from Anyone Else in the World, While
                Continuously Pushing the Cost of Great Design Down for Ordinary
                People. A Single Mother in the Heart of Africa, a Grandmother in
                the Polynesian Islands, or Anyone Living Anywhere on Earth Should
                Be Able to Get Surrounded By Beautiful Design.
              </p>
              <p>
                <BrandText>
                These Designs Come from Scott&apos;s Mind, Imagination, Taste, and
                Skill, Then Get Magnified By Ai. If You Love the Pictures and Work
                on This Website, That is the Difference: No One Else on Earth Can
                Do Exactly What WildWorks.Ai is Doing Unless They Simply Copy the
                Ideas.
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
            <motion.p className="wild-kicker wild-preserve-ai-case wild-kicker--framed" variants={fadeInLeft}>
              Ai-Native Websites
            </motion.p>
            <motion.h2 className="wild-section-title wild-line-title" variants={softScaleIn}>
              <LineTitle lines={["Want a", "Website Like This?"]} />
            </motion.h2>
            <motion.p
              className="wild-body wild-body--center wild-site-offer-copy"
              variants={fadeInRight}
            >
              <span className="wild-site-offer-copy__line">
                Scott himself built this site end-to-end. WildWorks is a working sample
              </span>
              <span className="wild-site-offer-copy__line">
                of a state-of-the-art Ai-driven website: avatar conversation, Ai conversion,
              </span>
              <span className="wild-site-offer-copy__line">
                lead intake, appointment setting, information gathering, and full automation,
              </span>
              <span className="wild-site-offer-copy__line">
                with a tasteful look and intuitive feel. If you would like Scott to build your website,
              </span>
              <span className="wild-site-offer-copy__line">
                talk to iScott, call, or text WildWorks. iScott will have the real Scott reach out to you.
              </span>
            </motion.p>
          </div>

          <motion.div className="wild-site-offer-grid" variants={stagger}>
            {aiWebsiteCapabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article key={item.title} className="wild-card wild-site-offer-card" variants={cardDrift} custom={index}>
                  <div className="wild-site-offer-card__heading">
                    <div className="wild-card-icon">
                      <Icon aria-hidden className="h-6 w-6" />
                    </div>
                    <h3 className="wild-line-title">
                      <LineTitle lines={item.titleLines} />
                    </h3>
                  </div>
                  <p>{item.body}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      <PhoneNumberLine
        className="wild-phone-number-line--home-footer"
        callText="Call Today!"
        emphasizeCallText
      />
    </div>
  );
}
