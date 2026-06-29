import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cssPath = path.join(repoRoot, "app", "globals.css");

const css = fs.readFileSync(cssPath, "utf8");
const compact = css.replace(/\s+/g, " ");

// G 2026-06-23: new look — smooth darker-brown -> golden center radial, no N-S line.
const expectedGradient =
  "radial-gradient(ellipse 120% 100% at 50% 36%, #693f18 0%, #502d12 38%, #3a200c 70%, #2b1607 100%)";

const required = [
  `--ww-center-gold-fade: ${expectedGradient};`,
  "--ww-page-background: var(--ww-center-gold-fade), #341607;",
  "background: var(--ww-page-background) !important;",
];

const forbidden = [
  "#291207",
  "linear-gradient(90deg, #2a1206 0%, #2d1507 8%, #311708 18%, #361a09 30%, #3a1d0b 42%, #3a1d0b 58%, #361a09 70%, #311708 82%, #2d1507 92%, #2a1206 100%)",
];

const missing = required.filter((needle) => !compact.includes(needle));
const stale = forbidden.filter((needle) => compact.includes(needle));

if (missing.length || stale.length) {
  console.error("WildWorks background lock failed.");
  if (missing.length) {
    console.error("Missing required lock:");
    for (const item of missing) console.error(`- ${item}`);
  }
  if (stale.length) {
    console.error("Found stale flat/darker background value:");
    for (const item of stale) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("WildWorks background lock OK.");
