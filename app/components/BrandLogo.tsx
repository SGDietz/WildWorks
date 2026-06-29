"use client";

import Image from "next/image";
import { motion } from "framer-motion";

// Shared WildWorks wordmark band, shown at the top of every page (home + subpages).
export default function BrandLogo() {
  return (
    <motion.div
      className="wild-top-logo-band"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ background: "transparent" }}
    >
      <Image
        src="/wildworks-live-logo-transparent-number2-v5.png"
        alt="WildWorks Fine Art and Practical Landscaping logo"
        width={1058}
        height={484}
        priority
        sizes="(max-width: 1216px) 75vw, 57rem"
        className="wild-top-logo"
        style={{ filter: "drop-shadow(0 1.1rem 1.4rem rgba(8, 3, 1, 0.42))" }}
      />
    </motion.div>
  );
}
