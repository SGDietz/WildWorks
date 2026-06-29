import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [72, 75, 86],
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
