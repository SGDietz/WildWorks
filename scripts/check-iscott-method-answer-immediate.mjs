import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parsing = await readFile(path.join(root, "src/lib/iscottLeadParsing.ts"), "utf8");
const capture = await readFile(path.join(root, "src/lib/iscottLeadCapture.ts"), "utf8");

assert.match(
  parsing,
  /if \(visitorChoseContactMethod\(trimmed\)\) return true;/,
  "A bare chosen contact method must bypass the fragment hold guard.",
);
assert.match(capture, /const methodOnly = extractContactMethod\(text\);/);
assert.match(
  capture,
  /if \(!shouldParseLeadFacts\(text\) && !isOperatorCorrection\(text\)\) \{\s*if \(methodOnly\) contactMethod = methodOnly;\s*continue;/s,
  "Held non-contact fragments must retain a chosen email or phone method.",
);
console.log("iScott immediate contact-method regression check passed.");
