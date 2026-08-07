import type { ReactNode } from "react";
import { ORGANIZATION_ID, SITE_URL, StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "The Ruins: Fine Art Stone Garden and Reflecting Pool";
const description = "See how WildWorks created The Ruins in Federal Hill, Baltimore: reclaimed granite, stone patios, a reflecting pool, and a convincing historic backstory.";
const path = "/pages/The-ruins";
const image = "/ww-art-ruins.jpeg";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "The Ruins stone garden and reflecting pool created by WildWorks in Baltimore",
});

export default function RuinsLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
    mainEntity: {
      "@type": "CreativeWork",
      "@id": `${SITE_URL}${path}/#project`,
      name: "The Ruins",
      creator: { "@id": ORGANIZATION_ID },
      image: `${SITE_URL}${image}`,
      description,
      locationCreated: {
        "@type": "Place",
        name: "Federal Hill, Baltimore, Maryland",
      },
    },
  });
  return <><StructuredData data={data} />{children}</>;
}
