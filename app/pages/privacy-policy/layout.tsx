import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Privacy Policy";
const description = "How WildWorks collects, uses, shares, protects, and responds to information submitted through the website, iScott, email, text, phone, and project conversations.";
const path = "/pages/privacy-policy";
export const metadata = buildPageMetadata({ title, description, path });
export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
