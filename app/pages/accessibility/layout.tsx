import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Accessibility Statement";
const description = "WildWorks' accessibility goals, known limits, supported alternatives, and contact information for reporting a website accessibility barrier.";
const path = "/pages/accessibility";
export const metadata = buildPageMetadata({ title, description, path });
export default function AccessibilityLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
