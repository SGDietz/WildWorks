import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repoRoot, "app");
const authorityPath = path.join(appRoot, "H221-sitewide-five-color-authority.css");

const canonical = new Map([
  ["--ww-primary", "#9f4719"],
  ["--ww-card", "#c56222"],
  ["--ww-text-1", "#fce0ad"],
  ["--ww-text-2", "#f1bf75"],
  ["--ww-text-3", "#d5823a"],
]);
const forbiddenDrift = ["#913f16", "#b65a1e", "#f7d9a5", "#e8b66d", "#c87936"];

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
