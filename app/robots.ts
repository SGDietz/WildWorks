import type { MetadataRoute } from "next";

const siteUrl = "https://wildworks.live";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/pages/Inspiration",
        "/pages/avatar-iscott",
        "/pages/avatar-iscott-assets/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
