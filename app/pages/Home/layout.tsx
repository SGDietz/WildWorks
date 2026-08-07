import type { ReactNode } from "react";
import { ORGANIZATION_ID, StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Fine Art Natural Stone Landscaping and Design Build";
const description = "WildWorks designs and builds natural stone landscapes, patios, outdoor fireplaces, stairs, boulder work, and original outdoor living spaces.";
const path = "/pages/Home";
const image = "/wildworks-home-banner-20260726.png";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "WildWorks natural stone steps and landscape with the artist standing beside the work",
});

export default function HomeLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
    mainEntity: { "@id": ORGANIZATION_ID },
  });
  return <><StructuredData data={data} />{children}</>;
}
