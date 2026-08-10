import type { ReactNode } from "react";
import { ORGANIZATION_ID, SITE_URL, StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Who Is Scott G. Dietz?";
const description = "Meet WildWorks founder Scott G. Dietz, a Baltimore-area fine artist, master stonemason, designer, builder, and lifelong problem solver with more than 40 years of experience.";
const path = "/pages/who-is-g";
const image = "/wildworks-home-banner-20260726.png";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "Scott G. Dietz standing beside a WildWorks natural stone landscape",
});

export default function BioLayout({ children }: { children: ReactNode }) {
  const personId = `${SITE_URL}/#scott-g-dietz`;
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
    type: "ProfilePage",
    mainEntity: {
      "@type": "Person",
      "@id": personId,
      name: "Scott G. Dietz",
      url: `${SITE_URL}${path}`,
      image: `${SITE_URL}${image}`,
      jobTitle: "Fine Artist, Designer, Builder, and Master Stonemason",
      worksFor: { "@id": ORGANIZATION_ID },
      description,
    },
  });
  return <><StructuredData data={data} />{children}</>;
}
