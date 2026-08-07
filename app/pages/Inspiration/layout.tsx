import type { ReactNode } from "react";
import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Inspiration",
  description: "A private WildWorks inspiration gallery that is not currently part of the public website.",
  path: "/pages/Inspiration",
  noIndex: true,
});

export default function InspirationLayout({ children }: { children: ReactNode }) {
  return children;
}
