"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { isLegalRoute } from "../lib/legalRoutes";
import { mainNavigationTabs, normalizeMainNavigationPath } from "../lib/mainNavigation";

// Every main navigation route shares the same wordmark. Legal and secondary
// routes retain their existing route-specific behavior.
export default function BrandLogo() {
  const pathname = usePathname();
  const normalizedPath = normalizeMainNavigationPath(pathname);
  const mainRoute = mainNavigationTabs.some((tab) => tab.href === normalizedPath);

  if (isLegalRoute(pathname)) {
    return null;
  }

  return (
    <motion.div
      className={`wild-top-logo-band${mainRoute ? "" : " wild-top-logo-band--subpage"}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ background: "transparent" }}
    >
      <span
        role="img"
        aria-label="WildWorks, Fine Art and Practical Landscaping"
        className="wild-top-logo"
        style={{ marginTop: "-0.25rem", marginBottom: "-0.25rem" }}
      >
        <Image
          src="/wildworks-live-logo-transparent-number2-v5.png"
          alt=""
          aria-hidden="true"
          width={1058}
          height={484}
          priority
          sizes="(max-width: 500px) 94vw, (max-width: 1216px) 75vw, 57rem"
          className="wild-top-logo-source"
        />
      </span>
    </motion.div>
  );
}
