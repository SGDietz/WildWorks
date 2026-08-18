import crypto from "node:crypto";

const baseUrls = (process.env.WW_PALETTE_BASE_URLS ?? "http://127.0.0.1:3020")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);
const routes = [
  "/pages/Home",
  "/pages/Projects",
  "/pages/who-is-g",
  "/pages/The-ruins",
  "/pages/Wildfire",
  "/pages/communications",
];
const requiredServedCss = [
  "--ww-primary:#9f4719",
  "--ww-card:#c56222",
  "--ww-text-1:#fce0ad",
  "--ww-text-2:#f1bf75",
  "--ww-text-3:#d5823a",
  "ww-ruins-primary-material",
];

for (const baseUrl of baseUrls) {
  let servedCss = "";
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}?paletteQa=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${baseUrl}${route} returned ${response.status}`);
    const html = await response.text();
    if (!servedCss) {
      const hrefs = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((match) => match[1]);
      for (const href of new Set(hrefs)) {
        const cssUrl = new URL(href, baseUrl);
        cssUrl.searchParams.set("paletteQa", Date.now().toString());
        const cssResponse = await fetch(cssUrl, { cache: "no-store" });
        if (!cssResponse.ok) throw new Error(`${cssUrl} returned ${cssResponse.status}`);
        servedCss += await cssResponse.text();
      }
    }
  }

  const compactCss = servedCss.toLowerCase().replace(/\s+/g, "");
  const missing = requiredServedCss.filter((needle) => !compactCss.includes(needle));
  if (missing.length) throw new Error(`${baseUrl} is serving stale palette CSS; missing ${missing.join(", ")}`);
  const hash = crypto.createHash("sha256").update(servedCss).digest("hex");
  console.log(`WildWorks served palette OK: ${baseUrl} css-sha256=${hash}`);
}
