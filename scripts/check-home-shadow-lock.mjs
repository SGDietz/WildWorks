import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = name => readFileSync(resolve(root, name), "utf8");
const digest = value => createHash("sha256").update(value).digest("hex");
const referencePath = "scripts/wildworks-afternoon-reference.json";
// Preserve historical bytes; latest selected screenshot correction is recorded separately.
// Do not regenerate this reference from an agent's new visual output.
const REFERENCE_SHA256 = "a49b1d55cbfbbd1e1ee7770315602d14967b2ba46a33652adbae18ebfffdd621";
const deltaPath = "scripts/wildworks-authorized-heading-deltas.json";
const dependenciesPath = "scripts/wildworks-appearance-dependencies.json";
const DELTA_SHA256 = "4ba0d52a6975acb6dfe9dda738f3be53ce8459b21020478ec2a00150e94fabab";
const DEPENDENCIES_SHA256 = "0bc68da109c74e329f9f87006678d6b988e400f885fc312b4836be38378f5e7b";
const selectedPath = "scripts/wildworks-selected-visual-reference.json";
const SELECTED_SHA256 = "d35fc14d6dea777d748ea1ff8c56a615c6d68cb54d218ecab034b86ceb3f68e3";
const selected = JSON.parse(read(selectedPath));
const contactPath = "scripts/wildworks-mobile-contact-delta.json";
const CONTACT_SHA256 = "96e0f9a31e5b7d9758618710ff687167e01d7e4a1e3368a2a06ebad743d4f4cf";
const contact = JSON.parse(read(contactPath));
const finishPath = "scripts/wildworks-five-page-contact-delta.json";
const FINISH_SHA256 = "1ed214b1ffaad74d0c10cdaab8cc64a5210d5a89b30da4ba667179c4f3491f8f";
const finish = JSON.parse(read(finishPath));
const largeContactPath = "scripts/wildworks-large-contact-correction.json";
const LARGE_CONTACT_SHA256 = "3dbffefebadcdf936edb795ad41dfa98694d5e7f8d07a42289b904d9dd976649";
const largeContact = JSON.parse(read(largeContactPath));
const corporateContactPath = "scripts/wildworks-corporate-phone-footer-20260911.json";
const CORPORATE_CONTACT_SHA256 = "6674611fa0ad779568fe9333b88884c7151294ae5d8b34d218b8b5c6b8733cbf";
const corporateContact = JSON.parse(read(corporateContactPath));
const approved = JSON.parse(read(deltaPath));
const dependencies = JSON.parse(read(dependenciesPath));
const referenceText = read(referencePath);
const reference = JSON.parse(referenceText);
const cssImports = source => [...source.matchAll(/^import\s+["'][^"']+\.css["'];?\s*$/gm)]
  .map(match => match[0].trim()).join("\n");

function violations(readSource) {
  const failures = [];
  if (digest(readSource(corporateContactPath)) !== CORPORATE_CONTACT_SHA256) failures.push("Corporate phone/footer authorization changed");
  if (digest(readSource(largeContactPath)) !== LARGE_CONTACT_SHA256) failures.push("Large-letter contact correction changed");
  if (digest(readSource(finishPath)) !== FINISH_SHA256) failures.push("Five-page contact authorization changed");
  if (digest(readSource(contactPath)) !== CONTACT_SHA256) failures.push("Authorized mobile contact correction or stop rule changed");
  if (digest(readSource(selectedPath)) !== SELECTED_SHA256) failures.push("G-selected September 7 visual reference changed");
  if (digest(readSource(referencePath)) !== REFERENCE_SHA256) failures.push("Dated appearance reference changed");
  if (digest(readSource(deltaPath)) !== DELTA_SHA256) failures.push("Authorized delta record changed");
  if (digest(readSource(dependenciesPath)) !== DEPENDENCIES_SHA256) failures.push("Appearance dependency reference changed");
  for (const [path, sha256] of Object.entries(dependencies.files)) {
    if (digest(readSource(path)) !== (corporateContact.files[path]?.after ?? sha256)) failures.push(`Appearance dependency changed: ${path}`);
  }
  for (const [path, sha256] of Object.entries(reference.files)) {
    if (digest(readSource(path)) !== (corporateContact.files[path]?.after ?? largeContact.files[path]?.after ?? finish.files[path]?.after ?? contact.files[path]?.after ?? selected.files[path]?.after ?? approved.files[path]?.after ?? sha256)) failures.push(`Afternoon source changed: ${path}`);
  }
  if (digest(cssImports(readSource("app/layout.tsx"))) !== reference.stylesheetImportsSha256) failures.push("Stylesheet import order changed");
  const renderer = readSource("app/components/ZeroShadowEnforcer.tsx");
  if (/<fe(Morphology|ConvolveMatrix|Flood)/.test(renderer)) failures.push("Rejected silhouette renderer reintroduced");
  if (!renderer.includes('}px 0 #000`;')) failures.push("Original single black text-shadow renderer changed");
  const scripts = JSON.parse(readSource("package.json")).scripts;
  for (const hook of ["predev", "prebuild", "prestart"]) {
    if (scripts[hook] !== "npm run check:home-shadow-lock") failures.push(`Missing guard hook: ${hook}`);
  }
  if (scripts["check:home-shadow-lock"] !== "node scripts/check-home-shadow-lock.mjs") failures.push("Guard command changed");
  return failures;
}

const failures = violations(read);
if (failures.length) {
  console.error("WildWorks selected visual reference lock FAILED. Do not rebaseline or bypass it. Read AGENTS.md and G's exact scope.");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else if (process.argv.includes("--self-test")) {
  const path = "app/components/ZeroShadowEnforcer.tsx";
  const original = read(path);
  const cases = [
    ["imported CSS drift", "app/globals.css", read("app/globals.css") + "\n/* unauthorized change */\n"],
    ["brown ink", path, original.replace("#000", "#321005")],
    ["shadow geometry", path, original.replace("OFFSET_PX = 0.5", "OFFSET_PX = 2")],
    ["silhouette renderer", path, original + "\n// <feConvolveMatrix />\n"],
    ["deleted small shadow", path, original.replace("#000", "transparent")],
    ["legal change", "app/pages/privacy-policy/page.tsx", read("app/pages/privacy-policy/page.tsx") + "\n"],
    ["reference rebaseline", referencePath, referenceText.replace('"reference":', '"changedReference":')],
    ["selected reference rebaseline", selectedPath, read(selectedPath) + "\n"],
    ["mobile contact rollback", path, original.replace('compactContact && !element.closest(CONTROL_SELECTOR)', 'false && !element.closest(CONTROL_SELECTOR)')],
    ["mobile authority rebaseline", contactPath, read(contactPath) + "\n"],
    ["new stylesheet", "app/layout.tsx", read("app/layout.tsx") + '\nimport "./new-shadow.css";\n'],
    ["guard hook bypass", "package.json", read("package.json").replace('"prebuild": "npm run check:home-shadow-lock"', '"prebuild": "echo bypass"')],
  ];
  for (const [name, file, altered] of cases) {
    assert.notEqual(altered, read(file), `Invalid test fixture: ${name}`);
    assert(violations(p => p === file ? altered : read(p)).length, `Did not reject ${name}`);
  }
  console.log("Twelve negative controls rejected. No source files were mutated.");
} else {
  console.log(`Selected appearance plus explicit mobile contact correction matched: ${Object.keys(reference.files).length} protected reference files with explicit heading deltas, imported stylesheets, layout and npm hooks.`);
  console.log("This is restoration/drift evidence, not permission to redesign or a substitute for device review.");
}
