import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Legal and Policy Center";
const description = "Find WildWorks privacy, communications, terms, disclaimer, accessibility, and Ai disclosure policies in one place.";
const path = "/pages/Wildworks";

export const metadata = buildPageMetadata({ title, description, path });

export default function LegalIndexLayout({ children }: { children: ReactNode }) {
  const data = buildPageStructuredData({ name: `${title} | WildWorks`, description, path, type: "CollectionPage" });
  return <><StructuredData data={data} />{children}</>;
}
