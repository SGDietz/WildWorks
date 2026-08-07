import type { ReactNode } from "react";
import { ORGANIZATION_ID, SITE_URL, StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Project Wildfire: Outdoor Fireplace and Patio Build";
const description = "Explore 93 field photos documenting Project Wildfire from breaking ground through its outdoor fireplace, patio, lounge, upper deck, and first wood fire.";
const path = "/pages/Wildfire";
const image = "/ww-wildfire-night-01-fireplace-patio-lights-off-dark-20260801.png";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "Project Wildfire outdoor fireplace, Celtic cross patio, and stonework lit at night",
});

export default function WildfireLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
    type: "CollectionPage",
    mainEntity: {
      "@type": "CreativeWork",
      "@id": `${SITE_URL}${path}/#project`,
      name: "Project Wildfire",
      creator: { "@id": ORGANIZATION_ID },
      image: `${SITE_URL}${image}`,
      description,
    },
  });
  return <><StructuredData data={data} />{children}</>;
}
