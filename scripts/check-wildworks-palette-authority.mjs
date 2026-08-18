import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repoRoot, "app");
const authorityPath = path.join(appRoot, "H221-sitewide-five-color-authority.css");

// G 2026-08-18: new canonical backgrounds, sampled from his keeper photo
// (KeeperColors-WW-Website-20260817/PXL_20260817_165426109.jpg) - the build he
// called "the key master". #9f4719 / #c56222 are now themselves drift and are
// listed as forbidden below, so the site cannot slide back to them.
// The three text tokens are unchanged.
const canonical = new Map([
  ["--ww-primary", "#c44d0b"],
  ["--ww-card", "#e96819"],
  ["--ww-text-1", "#fce0ad"],
  ["--ww-text-2", "#edc775"],
  ["--ww-text-3", "#f08c28"],
]);
// G locked the five on 2026-08-18 after a long tuning session and said: "this is
// the final colors. No drift." Every value below is one the site used at some
// point today and moved away from. Any of them reappearing in app/ fails the
// build, so the palette cannot quietly slide back to an earlier round.
const forbiddenDrift = [
  "#913f16", "#b65a1e", "#f7d9a5", "#e8b66d", "#c87936",
  // original palette, replaced
  "#9f4719", "#c56222",
  // old A/B pair and its micro-variants
  "#983e17", "#9d421a", "#963e17",
  // primaries tried and rejected
  "#c44827", "#cb4c2c", "#e6661c", "#d1550f",
  // card tried and rejected
  "#d76336",
  // text-2 tried and rejected
  "#f1bf75", "#f5ca95", "#f7d06e", "#f6ce80",
  // text-3 tried and rejected
  "#d5823a", "#f6a05f", "#f0935c", "#f0862b", "#e57d24", "#ea8329", "#e67820",
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(css|tsx?|jsx?)$/i.test(entry.name) ? [fullPath] : [];
  });
}

const failures = [];
const authority = fs.readFileSync(authorityPath, "utf8").toLowerCase();
for (const [token, value] of canonical) {
  const declaration = `${token}: ${value} !important;`;
  const count = authority.split(declaration).length - 1;
  if (count !== 1) failures.push(`${declaration} must appear exactly once in H221 (found ${count})`);
}

for (const filePath of walk(appRoot)) {
  const source = fs.readFileSync(filePath, "utf8").toLowerCase();
  for (const forbidden of forbiddenDrift) {
    if (source.includes(forbidden)) {
      failures.push(`${path.relative(repoRoot, filePath)} contains rejected drift color ${forbidden}`);
    }
  }
}

if (failures.length) {
  console.error("WildWorks palette authority failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WildWorks palette authority OK: canonical H221 tokens are unique and rejected drift colors are absent from active app sources.");
