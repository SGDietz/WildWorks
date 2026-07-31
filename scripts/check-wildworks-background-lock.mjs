import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cssPath = path.join(repoRoot, "app", "globals.css");
const layoutPath = path.join(repoRoot, "app", "layout.tsx");
const nextConfigPath = path.join(repoRoot, "next.config.ts");

const css = fs.readFileSync(cssPath, "utf8");
const compact = css.replace(/\s+/g, " ");
const layout = fs.readFileSync(layoutPath, "utf8");
const compactLayout = layout.replace(/\s+/g, " ");
const nextConfig = fs.readFileSync(nextConfigPath, "utf8");
const compactNextConfig = nextConfig.replace(/\s+/g, " ");

// G 2026-07-26: one bright copper/orange canvas on every route and viewport.
const expectedGradient =
  "linear-gradient(90deg, #983d17 0%, #a8471d 24%, #b95628 40%, #c26131 50%, #b95628 60%, #a8471d 76%, #983d17 100%)";
const expectedGlimmer =
  "linear-gradient( 90deg, rgba(255, 205, 130, 0) 0%, rgba(255, 205, 130, 0) 20%, rgba(255, 205, 130, 0.025) 30%, rgba(255, 205, 130, 0.05) 40%, rgba(255, 205, 130, 0.075) 50%, rgba(255, 205, 130, 0.05) 60%, rgba(255, 205, 130, 0.025) 70%, rgba(255, 205, 130, 0) 80%, rgba(255, 205, 130, 0) 100% )";
const expectedPageBackground =
  "var(--ww-center-column-glimmer), var(--ww-center-gold-fade), var(--ww-page-base-copper)";

const required = [
  "--ww-page-base-copper: #983d17;",
  `--ww-center-gold-fade: ${expectedGradient};`,
  `--ww-center-column-glimmer: ${expectedGlimmer};`,
  `--ww-page-background: ${expectedPageBackground};`,
  "background: var(--ww-page-background) !important;",
  "html, body, body .wild-site-backdrop { background: var(--ww-page-background) !important; background-color: var(--ww-page-base-copper) !important; background-repeat: no-repeat !important; background-position: center !important; background-size: cover !important; }",
  "body .wild-home.wild-legal-home .wild-legal-section, body .wild-subpage .wild-subpage-section, body footer.discordSection { background-color: transparent !important; background-image: none !important; }",
  "body .wild-home #signature-work .wild-signature-title__one { display: block; color: #f7d9a5 !important; -webkit-text-fill-color: #f7d9a5 !important; }",
  "body .wild-home #signature-work .wild-signature-title__two { display: block; color: #e8b66d !important; -webkit-text-fill-color: #e8b66d !important; }",
  "body .wild-home #signature-work .wild-signature-title__three { display: block; color: #c87936 !important; -webkit-text-fill-color: #c87936 !important; }",
];

const forbidden = [
  "#291207",
  "#a65322",
  "#90471f",
  "#98511f",
  "#351205",
  "#642b10",
  "radial-gradient(ellipse 130% 108% at 50% 34%, #ad642f 0%, #985024 34%, #7e3a18 68%, #642b10 100%)",
  "linear-gradient(90deg, #2a1206 0%, #2d1507 8%, #311708 18%, #361a09 30%, #3a1d0b 42%, #3a1d0b 58%, #361a09 70%, #311708 82%, #2d1507 92%, #2a1206 100%)",
];

const missing = required.filter((needle) => !compact.includes(needle));
const stale = forbidden.filter((needle) => compact.includes(needle));
const pageTokenCount = (css.match(/--ww-page-background\s*:/g) || []).length;
const centerTokenCount = (css.match(/--ww-center-gold-fade\s*:/g) || []).length;
const glimmerTokenCount = (css.match(/--ww-center-column-glimmer\s*:/g) || []).length;
const baseTokenCount = (css.match(/--ww-page-base-copper\s*:/g) || []).length;
const duplicateTokens = [];
if (pageTokenCount !== 1) duplicateTokens.push(`--ww-page-background (${pageTokenCount})`);
if (centerTokenCount !== 1) duplicateTokens.push(`--ww-center-gold-fade (${centerTokenCount})`);
if (glimmerTokenCount !== 1) duplicateTokens.push(`--ww-center-column-glimmer (${glimmerTokenCount})`);
if (baseTokenCount !== 1) duplicateTokens.push(`--ww-page-base-copper (${baseTokenCount})`);

const layoutRequired = [
  '<style data-wildworks-copper-canvas>{universalCopperCanvasCss}</style>',
  '--ww-page-base-copper: #983d17 !important;',
  '--ww-center-column-glimmer: linear-gradient(90deg, rgba(255, 205, 130, 0) 0%, rgba(255, 205, 130, 0) 20%, rgba(255, 205, 130, 0.025) 30%, rgba(255, 205, 130, 0.05) 40%, rgba(255, 205, 130, 0.075) 50%, rgba(255, 205, 130, 0.05) 60%, rgba(255, 205, 130, 0.025) 70%, rgba(255, 205, 130, 0) 80%, rgba(255, 205, 130, 0) 100%) !important;',
  '--ww-center-gold-fade: linear-gradient(90deg, #983d17 0%, #a8471d 24%, #b95628 40%, #c26131 50%, #b95628 60%, #a8471d 76%, #983d17 100%) !important;',
  'body .wild-site-backdrop { background: var(--ww-page-background) !important;',
  'body .wild-home.wild-legal-home .wild-legal-section, body .wild-subpage .wild-subpage-section, body footer.discordSection { background-color: transparent !important; background-image: none !important;',
  'themeColor: "#983d17",',
];
const missingLayout = layoutRequired.filter((needle) => !compactLayout.includes(needle));
const nextConfigRequired = ["devIndicators: false,"];
const missingNextConfig = nextConfigRequired.filter((needle) => !compactNextConfig.includes(needle));

if (missing.length || stale.length || duplicateTokens.length || missingLayout.length || missingNextConfig.length) {
  console.error("WildWorks background lock failed.");
  if (missing.length) {
    console.error("Missing required lock:");
    for (const item of missing) console.error(`- ${item}`);
  }
  if (stale.length) {
    console.error("Found stale flat/darker background value:");
    for (const item of stale) console.error(`- ${item}`);
  }
  if (duplicateTokens.length) {
    console.error("Background tokens must each be defined exactly once:");
    for (const item of duplicateTokens) console.error(`- ${item}`);
  }
  if (missingLayout.length) {
    console.error("Shared layout canvas guard is incomplete:");
    for (const item of missingLayout) console.error(`- ${item}`);
  }
  if (missingNextConfig.length) {
    console.error("Local preview edge guard is incomplete:");
    for (const item of missingNextConfig) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("WildWorks background lock OK.");
