import type { ReactNode } from "react";
import { StructuredData, buildPageMetadata, buildPageStructuredData } from "../../lib/seo";

const title = "Terms of Service";
const description = "The terms for using the WildWorks website, submitting project information, contacting iScott, receiving communications, and starting a project conversation.";
const path = "/pages/terms-of-service";
export const metadata = buildPageMetadata({ title, description, path });
export default function TermsLayout({ children }: { children: ReactNode }) {
  return <><StructuredData data={buildPageStructuredData({ name: `${title} | WildWorks`, description, path })} />{children}</>;
}
