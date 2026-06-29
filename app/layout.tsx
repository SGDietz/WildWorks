import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Baskerville, Great_Vibes } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import BrandLogo from "./components/BrandLogo";
import Footer from "./components/Footer";

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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wildworks.live").replace(/\/$/, "");
const homeUrl = `${siteUrl}/pages/Home`;
const heroImageUrl = `${siteUrl}/ww-art-wilds.jpeg`;

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
        email: "Wildworks@pm.me",
        telephone: "+1-443-797-2166",
        image: heroImageUrl,
        logo: `${siteUrl}/wildLogo.png`,
        sameAs: ["https://x.com/OfficialSGDietz"],
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
        <div className="relative min-h-screen overflow-hidden">
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <BrandLogo />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
