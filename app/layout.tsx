import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Baskerville, Great_Vibes } from "next/font/google";
import "./globals.css";
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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wildworks.live").replace(/\/$/, "");
const homeUrl = `${siteUrl}/pages/Home`;
const heroImageUrl = `${siteUrl}/wildworks-home-banner-20260726.png`;

// Permanent route-level canvas guard. This lives in the shared layout so a
// route chunk or responsive stylesheet cannot silently replace the approved
// copper/orange field on one device while leaving desktop correct.
const universalCopperCanvasCss = `
  :root {
    --ww-page-base-copper: #983d17 !important;
    --ww-center-column-glimmer: linear-gradient(90deg, rgba(255, 205, 130, 0) 0%, rgba(255, 205, 130, 0) 20%, rgba(255, 205, 130, 0.025) 30%, rgba(255, 205, 130, 0.05) 40%, rgba(255, 205, 130, 0.075) 50%, rgba(255, 205, 130, 0.05) 60%, rgba(255, 205, 130, 0.025) 70%, rgba(255, 205, 130, 0) 80%, rgba(255, 205, 130, 0) 100%) !important;
    --ww-center-gold-fade: linear-gradient(90deg, #983d17 0%, #a8471d 24%, #b95628 40%, #c26131 50%, #b95628 60%, #a8471d 76%, #983d17 100%) !important;
    --ww-page-background: var(--ww-center-column-glimmer), var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
  }

  html,
  body,
  body .wild-site-backdrop {
    background: var(--ww-page-background) !important;
    background-color: var(--ww-page-base-copper) !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: cover !important;
  }

  body .wild-site-backdrop {
    position: fixed !important;
    inset: 0 !important;
  }

  body :is(.wild-home, .wild-subpage),
  body :is(.wild-home, .wild-subpage) > :is(section, main),
  body .wild-home.wild-legal-home .wild-legal-section,
  body .wild-subpage .wild-subpage-section,
  body footer.discordSection {
    background-color: transparent !important;
    background-image: none !important;
  }

  @media (max-width: 719px) {
    :root {
      --ww-page-base-copper: #a8461b !important;
      --ww-center-column-glimmer: radial-gradient(ellipse 156% 92% at 50% 25%, rgba(255, 207, 137, 0.1) 0%, rgba(255, 178, 93, 0.05) 46%, rgba(255, 151, 64, 0.02) 68%, transparent 84%) !important;
      --ww-center-gold-fade: linear-gradient(90deg, #a8461b 0%, #b34f21 20%, #bd5928 38%, #c3632f 50%, #bd5928 62%, #b34f21 80%, #a8461b 100%) !important;
      --ww-page-background: var(--ww-center-column-glimmer), var(--ww-center-gold-fade), var(--ww-page-base-copper) !important;
    }

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
  alternates: {
    canonical: "/pages/Home",
  },
  openGraph: {
    title: "WildWorks | Fine Art Natural Stone Landscaping",
    description:
      "Natural stone patios, outdoor fireplaces, stairs, boulder work, and rare exterior transformations built to make properties unforgettable.",
    url: homeUrl,
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
  themeColor: "#983d17",
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
        "@type": "WebPage",
        "@id": `${homeUrl}/#webpage`,
        url: homeUrl,
        name: "WildWorks Fine Art Natural Stone Landscaping",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#organization` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: heroImageUrl,
          width: 2304,
          height: 1536,
        },
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
        areaServed: "United States",
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
        className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} ${greatVibes.variable} antialiased`}
      >
        <style data-wildworks-copper-canvas>{universalCopperCanvasCss}</style>
        <div className="relative min-h-screen overflow-hidden">
          <div className="wild-site-backdrop" aria-hidden="true" />
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
