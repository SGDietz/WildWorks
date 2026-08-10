import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Communications Policy";
const description = "How WildWorks may communicate by email, SMS, phone, social platforms, iScott follow-up, and related marketing or project channels, including opt-out choices.";
const path = "/pages/communications";
export const metadata = buildPageMetadata({ title, description, path });
export default function CommunicationsLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
