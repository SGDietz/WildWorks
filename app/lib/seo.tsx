import type { Metadata } from "next";

export const SITE_BROWSER_TITLE = "WildWorks Fine Art & Practical Landscaping";

export const SITE_URL = "https://wildworks.live";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const imageUrl = `${SITE_URL}/wildworks-share-preview-one-20260915.png`;

  return {
    title: { absolute: SITE_BROWSER_TITLE },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "WildWorks",
      images: [{ url: imageUrl, alt: "WildWorks Fine Art & Practical Landscaping: sunlit stone stairs and portrait", width: 1734, height: 907 }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: imageUrl, alt: "WildWorks Fine Art & Practical Landscaping: sunlit stone stairs and portrait", width: 1734, height: 907 }],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : {
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
}

type StructuredPageInput = {
  name: string;
  description: string;
  path: string;
  type?: "WebPage" | "CollectionPage" | "ProfilePage";
  image?: string;
  mainEntity?: Record<string, unknown>;
};

export function buildPageStructuredData({
  name,
  description,
  path,
  type = "WebPage",
  image,
  mainEntity,
}: StructuredPageInput) {
  const url = `${SITE_URL}${path}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": type,
        "@id": `${url}/#webpage`,
        url,
        name,
        description,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": ORGANIZATION_ID },
        ...(image
          ? {
              primaryImageOfPage: {
                "@type": "ImageObject",
                url: `${SITE_URL}${image}`,
              },
            }
          : {}),
        ...(mainEntity ? { mainEntity } : {}),
        inLanguage: "en-US",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/pages/Home`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: url,
          },
        ],
      },
    ],
  };
}

export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
