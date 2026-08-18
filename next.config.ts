import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local previews visually identical to the site. The Next development
  // badge/panel can leave a non-brand rail along a viewport edge.
  devIndicators: false,
  // G 2026-08-17: pages must never go stale in a visitor's browser — the
  // default year-long s-maxage made every install invisible until a hard
  // refresh. no-cache = the browser revalidates each visit (cheap 304 when
  // unchanged, fresh page the moment a new build ships). Hashed /_next
  // assets keep their own immutable caching and are not affected.
  async headers() {
    return [
      {
        source: "/:path((?!_next/).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
  images: {
    qualities: [72, 75, 86, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
