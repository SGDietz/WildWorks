import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wildworks.live").replace(/\/$/, "");

const routes: Array<{
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
}> = [
  { path: "/pages/Home", changeFrequency: "weekly", priority: 1 },
  { path: "/pages/Wildfire", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pages/The-ruins", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pages/who-is-g", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pages/Wildworks", changeFrequency: "yearly", priority: 0.4 },
  { path: "/pages/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pages/terms-of-service", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pages/disclaimer", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pages/communications", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pages/accessibility", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pages/ai-disclosure", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
