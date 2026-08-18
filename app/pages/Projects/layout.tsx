import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Projects";
const description = "A visual collection of WildWorks natural stone landscapes, gardens, walls, steps, fireplaces, and outdoor spaces.";
const path = "/pages/Projects";
const image = "/projects/01.jpg";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "WildWorks natural stone pond and garden",
});

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
    type: "CollectionPage",
  });

  return <><StructuredData data={data} />{children}</>;
}
