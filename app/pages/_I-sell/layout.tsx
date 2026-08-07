import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Landscaping That Helps Homes Sell";
const description = "Learn how WildWorks combines fine art, practical problem solving, and durable landscape construction to improve daily life and help homes stand out to buyers.";
const path = "/pages/I-sell";
const image = "/TravisGabby-20260731.png";

export const metadata = buildPageMetadata({
  title,
  description,
  path,
  image,
  imageAlt: "WildWorks boulder garden with natural stone, perennial flowers, and the artist seated in the landscape",
});

export default function ISellLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({
    name: `${title} | WildWorks`,
    description,
    path,
    image,
  });
  return <><StructuredData data={data} />{children}</>;
}
