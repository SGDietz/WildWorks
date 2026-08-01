import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "app");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const COMPANY_E164 = "+18776002474";
const COMPANY_DIGITS = "18776002474";
const PERSONAL_NUMBER_PATTERNS = [
  /14437972166/g,
  /\+?1?[\s().-]*443[\s().-]*797[\s().-]*2166/g,
];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const errors = [];
let telLinkCount = 0;

for (const file of sourceFiles(ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(process.cwd(), file);

  for (const pattern of PERSONAL_NUMBER_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) errors.push(`${relative}: exposes the personal 443 phone number`);
  }

  for (const match of source.matchAll(/tel:([^"'\s<]+)/g)) {
    telLinkCount += 1;
    if (match[1] !== COMPANY_E164) {
      errors.push(`${relative}: tel:${match[1]} must be tel:${COMPANY_E164}`);
    }
  }

  for (const match of source.matchAll(/sms:([^"'\s<]+)/g)) {
    if (match[1] !== COMPANY_E164) {
      errors.push(`${relative}: sms:${match[1]} must be sms:${COMPANY_E164}`);
    }
  }

  for (const match of source.matchAll(/api\.whatsapp\.com\/send\?phone=([0-9]+)/g)) {
    if (match[1] !== COMPANY_DIGITS) {
      errors.push(`${relative}: WhatsApp phone ${match[1]} must be ${COMPANY_DIGITS}`);
    }
  }
}

if (telLinkCount === 0) errors.push("No visitor-facing tel: links were found.");

if (errors.length) {
  console.error(`WildWorks phone-link check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `WildWorks phone-link check OK: ${telLinkCount} tel: links use ${COMPANY_E164}; no personal 443 number remains in app source.`,
);
