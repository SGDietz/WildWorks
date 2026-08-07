import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Disclaimer";
const description = "Important limits on WildWorks website information, project examples, iScott responses, property guidance, resale discussion, safety, permitting, and estimates.";
const path = "/pages/disclaimer";
export const metadata = buildPageMetadata({ title, description, path });
export default function DisclaimerLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
