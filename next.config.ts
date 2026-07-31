import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local previews visually identical to the site. The Next development
  // badge/panel can leave a non-brand rail along a viewport edge.
  devIndicators: false,
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
