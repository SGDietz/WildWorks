import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Libre_Baskerville,
  Great_Vibes,
  Playfair_Display,
  Manrope,
  Caladea,
} from "next/font/google";
import "./globals.css";
import "./gold-standard.css";
import "./grok-h58-h64.css";
import "./ab-two-color.css";
import "./H67-SOLID-blocks-only.css";
import "./H68-then-came-LOGO-EXACT.css";
import "./H69-UNDO-living-L-artifact.css";
import "./H70-bio-life-begins-line.css";
import "./H71-ruins-bio-playfair-manrope.css";
import "./signup-contrast.css";
import "./page-copper-lock.css";
import "./bio-hero-cleanup.css";
import "./footer-card-cleanup.css";
import "./narrative-footer-fix.css";
import "./gold-reference-sitewide.css";
import "./wildfire-summary-size.css";
import "./no-white-text.css";
import "./iscott-mobile-labels.css";
import "./home-hero-sizing.css";
import "./grok-h71r-h81.css";
import "./grok-h82-h96.css";
import "./sitewide-black-text-depth.css";
import "./button-ink.css";
import "./legal-white-lock.css";
import "./header-spacing-lock.css";
import "./subpage-color1-lock.css";
import "./narrative-band-lock.css";
import "./mobile-home-hero-balance.css";
import "./footer-spacing-lock.css";
import "./mobile-home-hero-rhythm-lock.css";
import "./mobile-subpage-home-palette.css";
import "./home-small-type-size-lock.css";
import "./button-text-size-lock.css";
import "./home-hero-copy-top-left.css";
import "./legal-footer-spacing-lock.css";
import "./all-card-surface-lock.css";
import "./legal-button-ink-lock.css";
import "./phone-number-lines.css";
import "./footer-signup-cleanup.css";
import "./wildfire-subpage-hero-rhythm-lock.css";
import "./brand-logo-tagline-effect-lock.css";
import "./card-surface-final-lock.css";
import "./large-letter-effect-lock.css";
import "./ipad-portrait-containment.css";
import "./home-hero-problems-size-lock.css";
import "./home-hero-mobile-center-lock.css";
import "./salmon-page-canvas-lock.css";
import "./wildfire-kicker-refinement.css";
import "./gold-standard-palette-and-buttons.css";
import "./home-hero-overall-size-lock.css";
import "./wildfire-final-emphasis-lock.css";
import "./solid-card-and-mobile-hero-lock.css";
import "./homepage-two-color-preview.css";
import "./H105s-home-65381E-card-rim-no-avatar.css";
import "./H106-home-buttons-match-talk-iscott.css";
import "./H106r-home-buttons-brand-bg-fill.css";
import "./H106s-home-buttons-brand-gold-sheen.css";
import "./H106t-upload-brand-gradient.css";
import "./H106u-home-buttons-card-color-sheen.css";
import "./H105u2-ruins-pic-no-rim-only.css";
import "./H106v-copy-talk-exact-brand-colors.css";
import "./H106w-talk-structure-brand-card-major.css";
import "./H106x-home-heading-color-key.css";
import "./H106x-exact-iscott-gold-all-buttons.css";
import "./H106y-upload-exact-talk.css";
import "./H106z-footer-brand-tone-and-legal-boundary.css";
import "./H107-home-hero-photo-contrast.css";
import "./H108-footer-legal-links-color-one.css";
import "./H109-mobile-tree-title-spacing.css";
import "./H110-footer-phone-and-mobile-ruins-spacing.css";
import "./H111-mobile-phone-spacing-audit.css";
import "./H112-home-color-three-surface-swap.css";
import "./H113-standard-brand-mobile-menu.css";
import "./H114-four-sided-desktop-nav-tabs.css";
import "./H115-canonical-landscaping-logo.css";
import "./H116-footer-closing-order-and-stripes.css";
import "./H117-home-wildfire-cta-width.css";
import "./H118-logo-and-round-mobile-controls.css";
import "./H119-home-top-third-harvest-wheat.css";
import "./H120-home-two-color-sequence.css";
import "./H121-home-mobile-hero-overlay.css";
import "./H122-home-mobile-call-today-spacing.css";
import "./H123-mobile-phone-divider-balance.css";
import "./H124-mobile-footer-thought-rhythm.css";
import "./H125-home-mobile-landscape-hero.css";
import "./H126-home-wildfire-orange-no-smoke.css";
import "./H127-sitewide-large-orange-no-smoke.css";
import "./H128-sitewide-back-to-top-home-match.css";
import "./H129-legal-text-match-public-site.css";
import "./H130-home-mobile-hero-type-step-up.css";
import "./H131-home-iscott-button-and-bottom-edge.css";
import "./H132-legal-document-pure-white.css";
import "./H133-home-tree-iscott-cta-test.css";
import "./H129-bio-background-spirit.css";
import "./H142-iscott-buttons-card-orange-mobile-balance.css";
import "./H143-mobile-footer-iscott-phone-group.css";
import "./H148-home-hero-iscott-20-percent.css";
import "./H152-home-craftsmanship-video.css";
import "./H153-projects-gallery.css";
import "./H156-hero-iscott-button-beauty.css";
import "./H157-sitewide-rectangular-action-buttons.css";
import "./H158-mobile-home-voice-feedback.css";
import "./H159-branded-video-controls.css";
import "./H159-home-mobile-hero-contact-final.css";
import "./H160-sitewide-solid-lightboxes.css";
import "./H161-home-phone-hero-type-and-contact-rhythm.css";
import "./H162-home-phone-wildfire-talk-match.css";
import "./H163-home-phone-projects-rhythm.css";
import "./H164-projects-organic-mosaic.css";
import "./H165-project-lightbox-minimal-controls.css";
import "./H166-mobile-footer-contact-buttons.css";
import "./H167-home-hero-text-smoke.css";
import "./H168-home-hdr-bright-palette.css";
import "./H169-start-with-iscott-color-two.css";
import "./H170-field-talk-ink-halfway-primary.css";
import "./H171-home-projects-section-card.css";
import "./H172-home-primary-center-light.css";
import "./H174-home-projects-primary-and-tagline.css";
import "./H175-video-circle-rings-soften.css";
import "./H176-home-video-outer-corners.css";
import "./H177-field-talk-ink-toward-card.css";
import "./H178a-hero-talk-button-box-20-percent.css";
import "./H179-projects-title-tagline-123.css";
import "./H183-wildfire-home-contact-and-mobile-projects.css";
import "./H184-sitewide-footer-home-hero-contact.css";
import "./H185-mobile-menu-edge-and-footer-number-face.css";
import "./H186-sitewide-footer-contact-rhythm.css";
import "./H187-projects-tagline-one-tone.css";
import "./H188-video-center-play-ring-brown.css";
import "./H189-projects-tagline-color-two.css";
import "./H190-home-face-and-wildfire-contact-gaps.css";
import "./H191-wildfire-kicker-playfair-largest.css";
import "./H192-effect-closer-projects-bio-rhythm.css";
import "./H193-wildfire-subtitle-color-two.css";
import "./H194-projects-title-plus-four.css";
import "./H195-home-video-phone-card.css";
import "./H196-services-heading-123.css";
import "./H197-ai-websites-heading-123.css";
import "./H198-home-video-card-and-controls.css";
import "./V01-video-play-ring-solid.css";
import "./H199-sitewide-footer-effects-and-legal-colors.css";
import "./H200-home-mobile-hero-contact-separation.css";
import "./H201-home-mobile-statement-spacing.css";
import "./H202-ipad-phone-face-sitewide.css";
import "./H203-ipad-portrait-number-scale.css";
import "./H206-talk-buttons-brightness-only.css";
import "./H207-services-title-black-effect.css";
import "./H208-footer-talk-brightness-only.css";
import "./H209-footer-rows-letter-effect.css";
import "./H210-wildfire-hero-no-contact-kicker-caps.css";
import "./H211-wildfire-gallery-home-contact.css";
import "./H212-projects-page-one-field.css";
import "./H213-home-first-talk-crisp-ink.css";
import "./H214-ruins-primary-field-and-contact.css";
import "./H215-projects-gallery-home-contact.css";
import "./H214-H215-shared-home-contact.css";
import "./H216-bio-home-contact.css";
import "./H217-lightbox-swipe.css";
import "./H218-home-video-card-padding.css";
import "./H219-home-projects-capabilities-copy.css";
import "./H220-sitewide-primary-center-light.css";
import "./H221-sitewide-five-color-authority.css";
import "./H222-ruins-realistic-palette-restoration.css";
import "./H223-home-projects-bio-palette.css";
import "./H226-bio-mobile-card-repair.css";
import "./H227-lightbox-polish.css";
import "./H228-held-lightbox-image.css";
import "./H229-projects-signup-panel.css";
import "./H230-ruins-card-copy-density.css";
import "./H231-home-glow-canvas-lock.css";
import "./H233-mobile-ipad-navigation-and-subpage-top.css";
import "./H234-mobile-ipad-legal-footer-color-scope.css";
import "./H235-menu-content-breathing-room.css";
import "./H236-route-swipe-refinement.css";
  import "./H238-main-page-headings-and-wildfire-overlay.css";
  import "./H242-home-ipad-portrait-projects-heading.css";
  import "./H239-wildfire-bio-hero-layout.css";
import "./H241-large-iscott-crisp-surface.css";
import "./H242-home-wildfire-paired-talk-brightness.css";
import "./H243-ruins-desktop-hero-scale.css";
import "./H244-legal-return-cta-spacing.css";
import "./H250-large-iscott-return-finish.css";
import "./H251-home-large-iscott-return-ink.css";
import "./H245-footer-dream-project-row-height.css";
import "./H246-home-wildfire-finished-mosaic.css";
import "./H247-ruins-phone-hero-geometry.css";
import "./H248-bio-phone-hero-geometry.css";
import "./H249-projects-phone-heading-lift.css";
import "./H250-home-reference-hero-frames.css";
import "./H252-mobile-contact-strip-integrity.css";
import "./H253-home-mobile-hero-viewer.css";
import "./H254-home-display-depth-remaining.css";
import "./H255-legal-footer-card-fit-and-title-depth.css";
import "./H256-iscott-mobile-legal-band.css";
import "./H257-wildfire-six-line-equal-depth.css";
import "./H258-services-heading-depth.css";
import "./H259-ai-websites-heading-depth.css";
import "./H260-footer-phone-match-stonework.css";
import "./H261-footer-phone-match-stonework-all-pages.css";
import "./H262-logo-uniform-five-pages.css";
import "./H263-start-iscott-middle-depth.css";
import "./H264-logo-tagline-same-shadow.css";
import "./H265-menu-bar-nice-shadow.css";
import "./H266-fireplace-subtitle-lighter.css";
import "./H267-six-line-lighten.css";
import "./H268-ruins-title-smidge-heavier.css";
import "./H269-projects-heading-balance.css";
import "./H270-services-heading-norm.css";
import "./H271-ai-websites-back-off.css";
import "./H272-phone-call-back-off.css";
import "./H273-talk-iscott-glow-dampen.css";
import "./H274-talk-iscott-glow-all-pages.css";
import "./H275-legal-return-button-inside.css";
import "./H276-iscott-large-titles-smidge-lighter.css";
import "./H279-logo-one-shadow-all-pages.css";
import "./H280-logo-scroll-shadow-everywhere.css";
import "./H281-front-door-shadow-lighter.css";
import "./H282-project-wildfire-title-heavier.css";
import "./H283-going-and-woodfire-lighter.css";
import "./H284-statement-text-lighter.css";
import "./H285-tree-of-life-title-heavier.css";
import "./H286-ruins-title-heavier-again.css";
import "./H287-projects-heading-rebalance.css";
import "./H288-services-norm-must-win.css";
// H289/H290 were a later unapproved shadow pass. Keep the files as rollback
// evidence, but do not load them over G's previously approved treatments.
import "./footer-iscott-panel-match.css";
import "./ruins-footer-seamless.css";
import "./letters-beautiful.css";
import "./shadow-sweep.css";
import "./approved-visual-locks.css";
import "./H292-wildfire-pair-match-reference.css";
import "./H293-home-batch1-small-copy.css";
import "./H294-project-wildfire-nudge.css";
import "./H295-hero-lede-correction.css";
import "./H296-variable-group-overrides.css";
import "./H297-hero-copy-and-headlines.css";
import "./H298-remaining-body-copy.css";
import "./H299-home-visual-intensity-correction.css";
import "./H300-home-reopened-nine.css";
import "./H301-home-fourstop-reissue.css";
import "./H302-projects-copy-and-below.css";
import "./H303-footer-contact-copy.css";
import "./H304-service-cards-and-headings.css";
import "./W01-wildfire-hero-text.css";
import "./R01-ruins-page-text.css";
import "./P01-projects-page-text.css";
import "./B01-bio-page-text.css";
import "./H305-services-heading.css";
import "./H307-statement-card-minus25.css";
import "./H306-breakpoint-corrections.css";
import "./A01-phone-avatar-size.css";
import "./L01-lightbox-scroll-lock.css";
import "./keeper-palette.css";
import "./S01-shadow-scale-tune.css";
import "./S02-desktop-shadow-pass.css";
import "./S03-mobile-shadow-pass.css";
import "./H308-talk-iscott-brightness-equal.css";
import "./H310-wildfire-title-glyph-fix.css";
import "./H311-wildfire-gallery-rolodex-note.css";
import "./H312-wildfire-title-playfair.css";
import "./H313-logo-shadow-gap-fill.css";
import "./H314-closing-phone-match-ruins.css";
import "./H315-contact-card-standard.css";
import "./H316-ruins-type-and-effect.css";
import "./H317-home-shadow-percentages.css";
import "./H318-talk-buttons-uniform-dampen.css";
import "./H319-home-batch2.css";
import "./H320-wildfire-batch.css";
import "./H321-projects-batch.css";
import "./H322-bio-batch.css";
import "./H323-text-colour-two.css";
import "./H324-flat-canvas.css";
import "./H325-home-shadow-walkthrough-20260819.css";
import "./H326-home-shadow-walkthrough-part2.css";
import "./H327-ipad-vertical-20260819.css";
import "./H328-ipad-vertical-part2.css";
import "./H331-ipad-vertical-p13-p16.css";
import "./H332-ipad-vertical-p3-p17-p20.css";
import "./H333-ipad-vertical-p2-p12.css";
import "./H334-avatar-box-dampen.css";
import "./H335-avatar-box-bottom-matches-top.css";
import "./H337-all-buttons-one-treatment.css";
import "./H338-projects-page-order.css";
import "./H339-projects-intro-and-gap.css";
import "./H340-iscott-front-door-small-text-color-one.css";
import "./H346-subpage-small-text-color-one.css";
import "./H350-small-text-shadow-back-off-10.css";
import "./H351-five-color-return.css";
import "./H352-remaining-small-text-colour-one.css";
import "./H353-mobile-shadow-pass.css";
import "./H354-wildfire-headline-playfair.css";
import "./H355-legal-return-button.css";
import "./H356-ruins-bio-body-join-h350.css";
import "./H357-bio-page.css";
import "./H358-ruins-page.css";
import "./H359-projects-and-all-phone-numbers.css";
import "./H360-top-logo-shadow-tight.css";
import "./H361-shadow-system-medium-and-large.css";
import "./H362-project-wildfire-font.css";
import "./H363-wildfire-heading-fit.css";
import "./H364-projects-intro-split.css";
import "./H365-shadow-system-completion.css";
import "./H368-home-page-complete.css";
import "./H369-sitewide-footer-and-wildfire.css";
import "./H370-home-last-stripers.css";
import "./H371-home-edge-mobile.css";
import "./H372-home-desktop-edge.css";
import "./H373-bio-heading-black-shadow.css";
import "./H374-home-shadow-opacity.css";
import "./H375-sitewide-shadow-opacity.css";
import "./H376-wildfire-title-match-home.css";
import "./H377-ruins-width-and-heading-colour.css";
import "./H378-title-font-match-home.css";
import "./H379-bio-size-spacing-phone.css";
import "./H380-projects-wildfire-ruins-pass.css";
import "./H381-mobile-home-punchlist.css";
import "./H382-home-walkthrough-20260819.css";
import "./H384-mobile-only-pass.css";
import "./H385-bio-large-heading-shadow.css";
import "./H386-ww-shadow-cleanup.css";
import "./H387-top-logo-shadow-match-projects.css";
import "./H388-menu-bar-shadow.css";
import "./H389-iscott-prompt-lines.css";
import "./H390-phone-audit-20260826.css";
import "./H391-wildfire-punchlines-pop.css";
import "./H392-homepage-center-shadow-text3.css";
import "./H393-homepage-text-colors.css";
import "./H394-homepage-visual-pass.css";
import "./H400-sitewide-button-icon-shadow.css";
import "./H395-homepage-button-icons.css";
import "./H396-homepage-front-door.css";
import "./H397-homepage-ruin-two-line.css";
import "./H399-home-ruin-width-and-stone-patio.css";
import "./H232-legal-white-zone-lock.css";
import Header from "./components/Header";
import BrandLogo from "./components/BrandLogo";
import Footer from "./components/Footer";
import TelemetryBoot from "./components/TelemetryBoot";
import MainPageSwipeNavigation from "./components/MainPageSwipeNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  variable: "--font-serif",
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  weight: "400",
  variable: "--font-script",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  weight: ["500", "600", "700"],
  variable: "--font-playfair",
  subsets: ["latin"],
});

const manrope = Manrope({
  weight: ["400", "500", "600"],
  variable: "--font-manrope",
  subsets: ["latin"],
});

const caladea = Caladea({
  weight: ["400", "700"],
  variable: "--font-caladea",
  subsets: ["latin"],
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wildworks.ai").replace(/\/$/, "");
const heroImageUrl = `${siteUrl}/wildworks-home-banner-20260726.png`;

// Permanent route-level canvas guard. This lives in the shared layout so a
// route chunk or responsive stylesheet cannot silently replace the approved
// copper/orange field on one device while leaving desktop correct.
const universalCopperCanvasCss = `
  :root {
    --ww-page-base-copper: var(--ww-primary) !important;
    --ww-center-column-glimmer: var(--ww-approved-center-light) !important;
    --ww-center-gold-fade: var(--ww-center-column-glimmer) !important;
    --ww-page-background: var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
    --ww-home-page-background: var(--ww-page-background) !important;
    --ww-soft-field: var(--ww-page-background) !important;
    --ww-soft-field-warm: var(--ww-page-background) !important;
  }

  html,
  body,
  body .wild-site-backdrop {
    background: var(--ww-page-background) !important;
    background-color: var(--ww-primary) !important;
    background-image: var(--ww-page-background) !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: cover !important;
    background-attachment: fixed !important;
  }

  body .wild-site-backdrop {
    position: fixed !important;
    inset: 0 !important;
    z-index: -1 !important;
    pointer-events: none !important;
  }

  body :is(.wild-home, .wild-subpage),
  body :is(.wild-home, .wild-subpage) > :is(section, main),
  body .wild-home.wild-legal-home .wild-legal-section,
  body .wild-subpage .wild-subpage-section,
  body footer.discordSection {
    background-color: transparent !important;
    background-image: none !important;
  }

  @media (min-width: 720px) and (max-width: 1680px) {
    :root {
      --ww-page-base-copper: var(--ww-primary) !important;
      --ww-center-column-glimmer: var(--ww-approved-center-light) !important;
      --ww-center-gold-fade: var(--ww-center-column-glimmer) !important;
      --ww-page-background: var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
    }

    html,
    body,
    body .wild-site-backdrop {
      background: var(--ww-page-background) !important;
      background-color: var(--ww-primary) !important;
    }
  }

  @media (max-width: 719px) {
    body .wild-home .wild-hero.discordSection,
    body .wild-home .wild-hero.discordSection .wild-hero-media,
    body .wild-home .wild-hero.discordSection .wild-hero-media > div,
    body .wild-home .wild-hero.discordSection .wild-hero-copy {
      background-color: transparent !important;
      background-image: none !important;
    }
  }
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WildWorks | Fine Art Natural Stone Landscaping",
    template: "%s | WildWorks",
  },
  description:
    "WildWorks designs and builds natural stone patios, outdoor fireplaces, stone stairs, boulder work, ruins, and high-impact landscape transformations.",
  keywords: [
    "WildWorks",
    "fine art landscaping",
    "natural stone patio",
    "outdoor fireplace",
    "stone stairs",
    "boulder work",
    "design build landscaping",
    "resale landscaping",
  ],
  openGraph: {
    title: "WildWorks | Fine Art Natural Stone Landscaping",
    description:
      "Natural stone patios, outdoor fireplaces, stairs, boulder work, and rare exterior transformations built to make properties unforgettable.",
    siteName: "WildWorks",
    images: [
      {
        url: heroImageUrl,
        width: 2304,
        height: 1536,
        alt: "WildWorks natural stone steps and landscape",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WildWorks | Fine Art Natural Stone Landscaping",
    description:
      "Fine art and practical landscaping: natural stone patios, outdoor fireplaces, stone stairs, and property-transforming boulder work.",
    images: [heroImageUrl],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#c44d0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "WildWorks",
        url: siteUrl,
        email: "hello@wildworks.ai",
        telephone: "+1-443-797-2166",
        image: heroImageUrl,
        logo: `${siteUrl}/wildLogo.png`,
        sameAs: ["https://x.com/WildWorksArt"],
        areaServed: {
          "@type": "Place",
          name: "Worldwide",
        },
        description:
          "WildWorks designs and builds fine art natural stone landscapes, outdoor fireplaces, stone patios, stairs, boulder work, ruins, and property transformations.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "WildWorks",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "Service",
        "@id": `${siteUrl}/#services`,
        name: "Fine art natural stone landscaping and design build",
        provider: { "@id": `${siteUrl}/#organization` },
        serviceType: [
          "Natural stone patios",
          "Outdoor fireplaces",
          "Stone stairs",
          "Boulder work",
          "Retaining and drainage features",
          "Landscape transformations",
        ],
        areaServed: {
          "@type": "Place",
          name: "Worldwide",
        },
        description:
          "Design/build natural stone landscapes for properties that need outdoor fireplaces, patios, stairs, boulder work, ruins, and unforgettable exterior spaces.",
      },
    ],
  };

  return (
    // G 2026-08-18: "when you hit refresh, a black rectangle comes up, you should
    // never see that." The copper canvas lives in CSS, so on a cold refresh the
    // browser paints its own canvas for the first frame or two before any
    // stylesheet arrives - and that frame is what he was seeing. An inline style
    // on <html> is in the markup itself, so the very first paint is already
    // brand copper. Belt and braces with the inline <style> further down, which
    // cannot apply until <body> starts parsing.
    <html lang="en" style={{ backgroundColor: "#c44d0b" }}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        id="wildworks-body"
        className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} ${greatVibes.variable} ${playfairDisplay.variable} ${manrope.variable} ${caladea.variable} antialiased`}
      >
        <style data-wildworks-copper-canvas>{universalCopperCanvasCss}</style>
        <div className="relative min-h-screen overflow-hidden">
          <div id="wild-site-backdrop" className="wild-site-backdrop" aria-hidden="true" />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <BrandLogo />
            <TelemetryBoot />
            <MainPageSwipeNavigation />
            <main className="wild-main-shell flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
