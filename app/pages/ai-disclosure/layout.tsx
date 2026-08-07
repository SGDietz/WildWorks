import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Ai Disclosure";
const description = "How WildWorks uses iScott, Ai-assisted intake and organization, human review, uploaded photos, and automated communications.";
const path = "/pages/ai-disclosure";
export const metadata = buildPageMetadata({ title, description, path });
export default function AiDisclosureLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
