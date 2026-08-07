import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Libre_Baskerville,
  Great_Vibes,
  Playfair_Display,
  Manrope,
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
import "./home-hero-problems-size-lock.css";
import "./card-surface-final-lock.css";
import "./large-letter-effect-lock.css";
import Header from "./components/Header";
import BrandLogo from "./components/BrandLogo";
import Footer from "./components/Footer";
import TelemetryBoot from "./components/TelemetryBoot";

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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wildworks.live").replace(/\/$/, "");
const heroImageUrl = `${siteUrl}/wildworks-home-banner-20260726.png`;

// Permanent route-level canvas guard. This lives in the shared layout so a
// route chunk or responsive stylesheet cannot silently replace the approved
// copper/orange field on one device while leaving desktop correct.
const universalCopperCanvasCss = `
  :root {
    --ww-page-base-copper: #983e17 !important;
    --ww-center-column-glimmer: radial-gradient(ellipse 62% 115% at 50% 45%, rgba(192, 82, 31, 0.2), transparent 72%) !important;
    --ww-center-gold-fade: linear-gradient(180deg, #9d421a 0%, #983e17 48%, #963e17 100%) !important;
    --ww-page-background: var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
    --ww-home-page-background: var(--ww-page-background) !important;
    --ww-soft-field: var(--ww-page-background) !important;
    --ww-soft-field-warm: var(--ww-page-background) !important;
  }

  html,
  body,
  body .wild-site-backdrop {
    background: var(--ww-page-background) !important;
    background-color: #983e17 !important;
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
      --ww-page-base-copper: #983e17 !important;
      --ww-center-column-glimmer: radial-gradient(ellipse 62% 115% at 50% 45%, rgba(192, 82, 31, 0.2), transparent 72%) !important;
      --ww-center-gold-fade: linear-gradient(180deg, #9d421a 0%, #983e17 48%, #963e17 100%) !important;
      --ww-page-background: var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
    }

    html,
    body,
    body .wild-site-backdrop {
      background: var(--ww-page-background) !important;
      background-color: #983e17 !important;
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
  themeColor: "#983e17",
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
        telephone: "+1-877-600-2474",
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
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        id="wildworks-body"
        className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} ${greatVibes.variable} ${playfairDisplay.variable} ${manrope.variable} antialiased`}
      >
        <style data-wildworks-copper-canvas>{universalCopperCanvasCss}</style>
        <div className="relative min-h-screen overflow-hidden">
          <div id="wild-site-backdrop" className="wild-site-backdrop" aria-hidden="true" />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <BrandLogo />
            <TelemetryBoot />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
