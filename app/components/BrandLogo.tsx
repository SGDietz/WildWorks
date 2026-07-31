"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { isLegalRoute } from "../lib/legalRoutes";

// Shared WildWorks wordmark band, shown at the top of every page (home + subpages).
export default function BrandLogo() {
  const pathname = usePathname();

  if (isLegalRoute(pathname)) {
    return null;
  }

  return (
    <motion.div
      className="wild-top-logo-band"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ background: "transparent" }}
    >
      <span
        role="img"
        aria-label="WildWorks, Fine Art and Practical Living"
        className="wild-top-logo"
      >
        <Image
          src="/wildworks-live-logo-transparent-living-v13.png"
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
