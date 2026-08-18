import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layoutPath = path.join(repoRoot, "app", "layout.tsx");
const lockPath = path.join(repoRoot, "app", "H232-legal-white-zone-lock.css");
const reviewRulePath = path.join(repoRoot, "docs", "WILDWORKS-VISUAL-REVIEW-RULE.md");
const failures = [];
const layout = fs.readFileSync(layoutPath, "utf8");
const lock = fs.readFileSync(lockPath, "utf8");

const stylesheetImports = [...layout.matchAll(/^import "(\.\/[^\"]+\.css)";$/gm)].map((match) => match[1]);
if (stylesheetImports.at(-1) !== "./H232-legal-white-zone-lock.css") {
  failures.push("H232 legal white-zone lock must remain the final global stylesheet import.");
}
for (const required of [
  "--ww-legal-zone-white: #fff",
  ".wild-legal-home *",
  "color: var(--ww-legal-zone-white) !important",
  "-webkit-text-fill-color: var(--ww-legal-zone-white) !important",
]) {
  if (!lock.includes(required)) failures.push(`H232 is missing required legal-zone authority: ${required}`);
}
if (!fs.existsSync(reviewRulePath)) failures.push("Named-selector visual review rule is missing.");

if (failures.length) {
  console.error("WildWorks legal white-zone guard failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WildWorks legal white-zone guard OK: final legal-document text lock and named-selector review rule are present.");
