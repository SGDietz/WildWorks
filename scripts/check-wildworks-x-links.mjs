import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appRoot = path.join(repoRoot, "app");
const profileUrl = "https://x.com/WildWorksArt";
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const failures = [];
let profileReferenceCount = 0;

for (const filePath of sourceFiles(appRoot)) {
  const source = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(repoRoot, filePath);

  if (/OfficialSGDietz|https:\/\/x\.com\/intent\//i.test(source)) {
    failures.push(`${relativePath}: contains a retired X destination`);
  }

  const directXUrls = source.match(/https:\/\/x\.com\/[^"'`\s<)}]+/gi) ?? [];
  for (const url of directXUrls) {
    profileReferenceCount += 1;
    if (url !== profileUrl) {
      failures.push(`${relativePath}: ${url}`);
    }
  }
}

if (profileReferenceCount === 0) {
  failures.push("No WildWorks X profile references were found");
}

if (failures.length) {
  console.error("WildWorks X profile lock failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`WildWorks X profile lock OK: ${profileReferenceCount} references use ${profileUrl}.`);
