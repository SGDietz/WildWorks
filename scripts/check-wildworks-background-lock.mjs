import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cssPath = path.join(repoRoot, "app", "globals.css");
const layoutPath = path.join(repoRoot, "app", "layout.tsx");
const goldStandardPath = path.join(repoRoot, "app", "gold-standard.css");
const referenceLockPath = path.join(repoRoot, "app", "gold-reference-sitewide.css");
const cardSurfaceLockPath = path.join(repoRoot, "app", "all-card-surface-lock.css");
const legalWhiteLockPath = path.join(repoRoot, "app", "legal-white-lock.css");
const legalPaletteLockPath = path.join(repoRoot, "app", "H129-legal-text-match-public-site.css");
const legalDocumentWhiteLockPath = path.join(repoRoot, "app", "H132-legal-document-pure-white.css");
const nextConfigPath = path.join(repoRoot, "next.config.ts");

const css = fs.readFileSync(cssPath, "utf8");
const compact = css.replace(/\s+/g, " ");
const layout = fs.readFileSync(layoutPath, "utf8");
const compactLayout = layout.replace(/\s+/g, " ");
const goldStandard = fs.readFileSync(goldStandardPath, "utf8");
const compactGoldStandard = goldStandard.replace(/\s+/g, " ");
const referenceLock = fs.readFileSync(referenceLockPath, "utf8");
const compactReferenceLock = referenceLock.replace(/\s+/g, " ");
const cardSurfaceLock = fs.readFileSync(cardSurfaceLockPath, "utf8");
const compactCardSurfaceLock = cardSurfaceLock.replace(/\s+/g, " ");
const legalWhiteLock = fs.readFileSync(legalWhiteLockPath, "utf8");
const compactLegalWhiteLock = legalWhiteLock.replace(/\s+/g, " ");
const legalPaletteLock = fs.readFileSync(legalPaletteLockPath, "utf8");
const compactLegalPaletteLock = legalPaletteLock.replace(/\s+/g, " ");
const legalDocumentWhiteLock = fs.readFileSync(legalDocumentWhiteLockPath, "utf8");
const compactLegalDocumentWhiteLock = legalDocumentWhiteLock.replace(/\s+/g, " ");
const nextConfig = fs.readFileSync(nextConfigPath, "utf8");
const compactNextConfig = nextConfig.replace(/\s+/g, " ");

// G 2026-08-05: use the exact gold-reference screenshot palette everywhere.
// The page is red copper, the cards are luminous burnt copper, never dirt brown.
const expectedGradient =
  "linear-gradient(180deg, #c44d0b 0%, #c44d0b 48%, #c44d0b 100%)";
const expectedPageBackground =
  "var(--ww-center-gold-fade), var(--ww-page-base-copper)";

const required = [
  "--ww-page-base-copper: #c44d0b;",
  `--ww-center-gold-fade: ${expectedGradient};`,
  "--ww-center-column-glimmer: radial-gradient(ellipse 62% 115% at 50% 45%, rgba(192, 82, 31, 0.2), transparent 72%);",
  `--ww-page-background: ${expectedPageBackground};`,
  "background: var(--ww-page-background) !important;",
  "html, body, body .wild-site-backdrop { background: var(--ww-page-background) !important; background-color: var(--ww-page-base-copper) !important; background-repeat: no-repeat !important; background-position: center !important; background-size: cover !important; }",
  "body .wild-home.wild-legal-home .wild-legal-section, body .wild-subpage .wild-subpage-section, body footer.discordSection { background-color: transparent !important; background-image: none !important; }",
  "body .wild-home #signature-work .wild-signature-title__one { display: block; color: #fce0ad !important; -webkit-text-fill-color: #fce0ad !important; }",
  "body .wild-home #signature-work .wild-signature-title__two { display: block; color: #edc775 !important; -webkit-text-fill-color: #edc775 !important; }",
  "body .wild-home #signature-work .wild-signature-title__three { display: block; color: #f08c28 !important; -webkit-text-fill-color: #f08c28 !important; }",
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
  'import "./gold-reference-sitewide.css";',
  'import "./all-card-surface-lock.css";',
  'import "./legal-white-lock.css";',
  'import "./H132-legal-document-pure-white.css";',
  'id="wildworks-body"',
  '--ww-page-base-copper: var(--ww-primary) !important;',
  '--ww-center-column-glimmer: var(--ww-approved-center-light) !important;',
  '--ww-center-gold-fade: var(--ww-center-column-glimmer) !important;',
  'body .wild-site-backdrop { background: var(--ww-page-background) !important;',
  'body .wild-home.wild-legal-home .wild-legal-section, body .wild-subpage .wild-subpage-section, body footer.discordSection { background-color: transparent !important; background-image: none !important;',
  // G 2026-08-18: canonical primary moved to the keeper-photo value.
  'themeColor: "#c44d0b",',
];
const missingLayout = layoutRequired.filter((needle) => !compactLayout.includes(needle));
// G 2026-08-05: mobile must use the exact desktop copper recipe. A responsive
// token override silently made the phone canvas look browner than desktop.
const forbiddenLayout = [
  '--ww-center-column-glimmer: radial-gradient(ellipse 220% 135% at 50% 28%',
  '--ww-center-gold-fade: linear-gradient(90deg, #983d17 0%, #9c4119 28%',
];
const staleLayout = forbiddenLayout.filter((needle) => compactLayout.includes(needle));
const forbiddenGoldStandard = [
  "linear-gradient(180deg, #9a3f18 0%, #983d17 48%, #953b16 100%)",
];
const staleGoldStandard = forbiddenGoldStandard.filter((needle) => compactGoldStandard.includes(needle));
const referenceRequired = [
  "--ww-reference-a: #c44d0b;",
  "--ww-reference-b: #e96819;",
  "--ww-color-1: #fce0ad !important;",
  "--ww-color-2: #edc775 !important;",
  "--ww-color-3: #f08c28 !important;",
];
const missingReference = referenceRequired.filter((needle) => !compactReferenceLock.includes(needle));
const cardSurfaceRequired = [
  "--ww-card-flat: #e96819;",
  "background: var(--ww-card-finish, var(--ww-card-flat)) !important;",
  "background-image: var(--ww-card-finish, none) !important;",
];
const missingCardSurface = cardSurfaceRequired.filter((needle) => !compactCardSurfaceLock.includes(needle));
const legalPaletteRequired = [
  "--ww-legal-print-lock: #fce0ad;",
  "html body#wildworks-body#wildworks-body:has(.wild-legal-home) *",
  "color: var(--ww-legal-print-lock) !important;",
  "-webkit-text-fill-color: var(--ww-legal-print-lock) !important;",
  "H129-legal-text-match-public-site.css",
  "color: #fce0ad !important;",
  "color: #edc775 !important;",
  "color: #7d2f20 !important;",
];
const missingLegalPalette = legalPaletteRequired.filter(
  (needle) => !compactLegalWhiteLock.includes(needle)
    && !compactLegalPaletteLock.includes(needle)
    && !compactLayout.includes(needle),
);
const legalDocumentWhiteRequired = [
  ".wild-legal-home *",
  "color: #fff !important;",
  "-webkit-text-fill-color: #fff !important;",
];
const missingLegalDocumentWhite = legalDocumentWhiteRequired.filter(
  (needle) => !compactLegalDocumentWhiteLock.includes(needle),
);
const nextConfigRequired = ["devIndicators: false,"];
const missingNextConfig = nextConfigRequired.filter((needle) => !compactNextConfig.includes(needle));

if (missing.length || stale.length || duplicateTokens.length || missingLayout.length || staleLayout.length || staleGoldStandard.length || missingReference.length || missingCardSurface.length || missingLegalPalette.length || missingLegalDocumentWhite.length || missingNextConfig.length) {
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
  if (staleLayout.length) {
    console.error("Mobile must not redefine the universal desktop copper canvas:");
    for (const item of staleLayout) console.error(`- ${item}`);
  }
  if (staleGoldStandard.length) {
    console.error("Found a muddy Home-only canvas overriding the shared desktop blend:");
    for (const item of staleGoldStandard) console.error(`- ${item}`);
  }
  if (missingReference.length) {
    console.error("Final gold-reference palette lock is incomplete:");
    for (const item of missingReference) console.error(`- ${item}`);
  }
  if (missingCardSurface.length) {
    console.error("Gold-standard card-surface lock is incomplete:");
    for (const item of missingCardSurface) console.error(`- ${item}`);
  }
  if (missingLegalPalette.length) {
    console.error("Permanent legal-page public-site palette lock is incomplete:");
    for (const item of missingLegalPalette) console.error(`- ${item}`);
  }
  if (missingLegalDocumentWhite.length) {
    console.error("Upper legal-document pure-white lock is incomplete:");
    for (const item of missingLegalDocumentWhite) console.error(`- ${item}`);
  }
  if (missingNextConfig.length) {
    console.error("Local preview edge guard is incomplete:");
    for (const item of missingNextConfig) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("WildWorks background lock OK.");
