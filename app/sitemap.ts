import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wildworks.live").replace(/\/$/, "");

const showInspirationSubpage = false;

const routes = [
  "/",
  "/pages/Home",
  "/pages/Wildfire",
  ...(showInspirationSubpage ? ["/pages/Inspiration"] : []),
  "/pages/The-ruins",
  "/pages/I-sell",
  "/pages/who-is-g",
  "/pages/Wildworks",
  "/pages/privacy-policy",
  "/pages/terms-of-service",
  "/pages/disclaimer",
  "/pages/communications",
  "/pages/accessibility",
  "/pages/ai-disclosure",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/pages/Home" || route === "/" ? "weekly" : "monthly",
    priority: route === "/pages/Home" || route === "/" ? 1 : 0.7,
  }));
}
