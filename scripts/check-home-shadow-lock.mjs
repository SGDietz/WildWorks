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
// G, 2026-09-11 ~20:40 ET (Yes, relayed by Chief): the corporate phone reads 1+855-253-2727. Named exception layered on the
// corporate record above, which stays unchanged; its before hashes equal that record's after hashes. Recorded by Claude.
const phoneFormatPath = "scripts/wildworks-corporate-phone-1plus-20260911.json";
const PHONE_FORMAT_SHA256 = "70af9f99a5079509e60260190c6bc4f2897c77d2c07deb053e730091c179b8d1";
const phoneFormat = JSON.parse(read(phoneFormatPath));
// G, 2026-09-14 ~13:40 ET, to Claude: "change the phone number everywhere on the site to 1+443-797-2166".
// Content-only overlay for the phone-bearing files; historical records stay as they are.
const personalPhonePath = "scripts/wildworks-personal-phone-20260914.json";
const PERSONAL_PHONE_SHA256 = "a266c4426b543715c2aa12d9c57de3f10bcffbfd40c9d7cb62dd4d22ed565093";
const personalPhone = JSON.parse(read(personalPhonePath));
// G, 2026-09-14 ~15:00 ET, to Claude, inspecting WildWorks: the Tree of Life line out with a smiley after "Back Yard", the
// WildWorks Projects paragraphs in title case, and the page scrollbar bar in the primary background. Content-only overlay.
const gOrdersPath = "scripts/wildworks-g-orders-20260914-pm.json";
const G_ORDERS_SHA256 = "eb1a7dd593c1d48c18d0f7de00ec2464576564fbd94ee6b03ebfcc949d8b3b3d";
const gOrders = JSON.parse(read(gOrdersPath));
// G's separately authorized Home-only large shadow delta; all prior records stay intact.
const homeDoublePath = "scripts/wildworks-home-large-double-20260914.json";
const HOME_DOUBLE_SHA256 = "421b571a9ab4db5b04aced3bf4710f75b9ff1ce8d16cce7d3ed869d8dea854e8";
const homeDouble = JSON.parse(read(homeDoublePath));
// G's five-main-page and mobile-contact follow-on; prior authorization bytes stay intact.
const fiveMajorsPath = "scripts/wildworks-five-majors-shadow-20260914.json";
const FIVE_MAJORS_SHA256 = "5cba5db2e5da77905eb8fb430a6bc9f6f77362bb38072e773539ee78df13116d";
const fiveMajors = JSON.parse(read(fiveMajorsPath));
// G final clarification: only the medium tier may tighten; large/small remain frozen.
const mediumPath = "scripts/wildworks-medium-contact-20260914.json";
const MEDIUM_SHA256 = "831255f77d2d1fb30fde70278b7a9cb003e286c62b93cd6fa16600a5eee794b6";
const medium = JSON.parse(read(mediumPath));
// G rejected the medium1px result; keep its record immutable and append only this exact Grok correction.
const middlePath = "scripts/wildworks-medium-middle-ground-20260914.json";
const MIDDLE_SHA256 = "bf3d8cdb721d2647c53ef4fffe429d773fee2a1f2bcda7b0805d37b60cf08b3c";
const middle = JSON.parse(read(middlePath));
// G's 2026-09-15 medium-only heavier-large match; prior records stay immutable.
const heavyPath = "scripts/wildworks-medium-heavy-large-20260915.json";
const HEAVY_SHA256 = "c0659a89e21d762eb12a00c0fcf8fcd8f20a81ae6bc9ac3107a5e309858eaedb";
const heavy = JSON.parse(read(heavyPath));
const sweetPath = "scripts/wildworks-medium-sweet-spot-20260915.json";
const SWEET_SHA256 = "1de8739723d7c5b96e559dd2d938a51669b64f38995fda98f8873f53271d68f6";
const sweet = JSON.parse(read(sweetPath));
const signupPath = "scripts/wildworks-signup-shadow-20260915.json";
const SIGNUP_SHA256 = "d3d90def7bce937497d70caa3edd5be48ded952f7983aa2002c8d94aac47b023";
const signup = JSON.parse(read(signupPath));
const logoPath = "scripts/wildworks-logo-heavy-20260915.json";
const LOGO_SHA256 = "c16ffe342e2ee08193957a276d944104aaa8453a84adff2980b4c34ae2598204";
const logo = JSON.parse(read(logoPath));
const approved = JSON.parse(read(deltaPath));
const dependencies = JSON.parse(read(dependenciesPath));
const referenceText = read(referencePath);
const reference = JSON.parse(referenceText);
const cssImports = source => [...source.matchAll(/^import\s+["'][^"']+\.css["'];?\s*$/gm)]
  .map(match => match[0].trim()).join("\n");

function violations(readSource) {
  const failures = [];
  if (digest(readSource(sweetPath)) !== SWEET_SHA256) failures.push("Sweet-spot authorization changed");
  if (digest(readSource(signupPath)) !== SIGNUP_SHA256) failures.push("Signup shadow authorization changed");
  if (digest(readSource(logoPath)) !== LOGO_SHA256) failures.push("Logo-heavy authorization changed");
  const guardedFile = "app/components/ZeroShadowEnforcer.tsx";
  if (Object.keys(sweet.files).length !== 1 || Object.keys(signup.files).length !== 1 || Object.keys(logo.files).length !== 1 ||
      sweet.files[guardedFile]?.before !== heavy.files[guardedFile]?.after ||
      signup.files[guardedFile]?.before !== sweet.files[guardedFile]?.after ||
      logo.files[guardedFile]?.before !== signup.files[guardedFile]?.after ||
      digest(readSource(guardedFile)) !== logo.files[guardedFile]?.after) failures.push("Sweet/signup/logo source chain or scope changed");
  if (digest(readSource(heavyPath)) !== HEAVY_SHA256) failures.push("Heavy-medium authorization changed");
  const heavyFiles = Object.keys(heavy.files);
  if (heavyFiles.length !== 1 || heavyFiles[0] !== "app/components/ZeroShadowEnforcer.tsx" ||
      heavy.files[heavyFiles[0]].before !== middle.files[heavyFiles[0]]?.after ||
      heavy.files[heavyFiles[0]].after !== sweet.files[heavyFiles[0]]?.before) failures.push("Heavy-medium source chain or scope changed");
  if (digest(readSource(middlePath)) !== MIDDLE_SHA256) failures.push("Middle-ground authorization changed");
  const middleFiles = Object.keys(middle.files);
  if (middleFiles.length !== 1 || middleFiles[0] !== "app/components/ZeroShadowEnforcer.tsx" || middle.files[middleFiles[0]].before !== medium.files[middleFiles[0]]?.after) failures.push("Middle-ground source chain or scope changed");
  for (const [path, sha256] of Object.entries(middle.frozenLegalFiles)) {
    if (digest(path.endsWith(".docx") ? readFileSync(resolve(root,path)) : readSource(path)) !== sha256) failures.push(`Middle-ground pass changed frozen legal source: ${path}`);
  }
  if (digest(readSource(mediumPath)) !== MEDIUM_SHA256) failures.push("Medium-only authorization changed");
  const mediumFiles = Object.keys(medium.files);
  if (mediumFiles.length !== 1 || mediumFiles[0] !== "app/components/ZeroShadowEnforcer.tsx" || medium.files[mediumFiles[0]].before !== fiveMajors.files[mediumFiles[0]]?.after) failures.push("Medium-only source chain or scope changed");
  for (const [path, sha256] of Object.entries(medium.frozenLegalFiles)) {
    if (digest(path.endsWith(".docx") ? readFileSync(resolve(root,path)) : readSource(path)) !== sha256.toLowerCase()) failures.push(`Medium pass changed frozen legal source: ${path}`);
  }
  if (digest(readSource(fiveMajorsPath)) !== FIVE_MAJORS_SHA256) failures.push("Five-main-page shadow authorization changed");
  const fiveMajorsFiles = Object.keys(fiveMajors.files);
  if (fiveMajorsFiles.length !== 1 || fiveMajorsFiles[0] !== "app/components/ZeroShadowEnforcer.tsx" ||
      fiveMajors.files[fiveMajorsFiles[0]].before !== homeDouble.files[fiveMajorsFiles[0]]?.after) {
    failures.push("Five-main-page delta scope or source chain changed");
  }
  for (const [path, sha256] of Object.entries(fiveMajors.frozenAssets)) {
    if (digest(readFileSync(resolve(root, path))) !== sha256) failures.push(`Frozen logo asset changed: ${path}`);
  }

  if (digest(readSource(homeDoublePath)) !== HOME_DOUBLE_SHA256) failures.push("Home-only stronger-shadow authorization changed");
  const homeDoubleFiles = Object.keys(homeDouble.files);
  if (homeDoubleFiles.length !== 1 || homeDoubleFiles[0] !== "app/components/ZeroShadowEnforcer.tsx" ||
      homeDouble.files[homeDoubleFiles[0]].before !== largeContact.files[homeDoubleFiles[0]]?.after) {
    failures.push("Home-only delta scope or source chain changed");
  }
  for (const [path, sha256] of Object.entries(homeDouble.frozenLegalFiles)) {
    if (digest(path.endsWith(".docx") ? readFileSync(resolve(root, path)) : readSource(path)) !== sha256) failures.push(`Frozen legal source changed: ${path}`);
  }
  if (digest(readSource(gOrdersPath)) !== G_ORDERS_SHA256) failures.push("G 09-14 afternoon WildWorks orders changed");
  if (digest(readSource(personalPhonePath)) !== PERSONAL_PHONE_SHA256) failures.push("Personal WildWorks phone authorization changed");
  if (digest(readSource(phoneFormatPath)) !== PHONE_FORMAT_SHA256) failures.push("Corporate phone 1+ format authorization changed");
  if (digest(readSource(corporateContactPath)) !== CORPORATE_CONTACT_SHA256) failures.push("Corporate phone/footer authorization changed");
  if (digest(readSource(largeContactPath)) !== LARGE_CONTACT_SHA256) failures.push("Large-letter contact correction changed");
  if (digest(readSource(finishPath)) !== FINISH_SHA256) failures.push("Five-page contact authorization changed");
  if (digest(readSource(contactPath)) !== CONTACT_SHA256) failures.push("Authorized mobile contact correction or stop rule changed");
  if (digest(readSource(selectedPath)) !== SELECTED_SHA256) failures.push("G-selected September 7 visual reference changed");
  if (digest(readSource(referencePath)) !== REFERENCE_SHA256) failures.push("Dated appearance reference changed");
  if (digest(readSource(deltaPath)) !== DELTA_SHA256) failures.push("Authorized delta record changed");
  if (digest(readSource(dependenciesPath)) !== DEPENDENCIES_SHA256) failures.push("Appearance dependency reference changed");
  for (const [path, sha256] of Object.entries(dependencies.files)) {
    if (digest(readSource(path)) !== (gOrders.files[path] ?? personalPhone.files[path] ?? phoneFormat.files[path]?.after ?? corporateContact.files[path]?.after ?? sha256)) failures.push(`Appearance dependency changed: ${path}`);
  }
  for (const [path, sha256] of Object.entries(reference.files)) {
    if (digest(readSource(path)) !== (logo.files[path]?.after ?? signup.files[path]?.after ?? sweet.files[path]?.after ?? heavy.files[path]?.after ?? middle.files[path]?.after ?? medium.files[path]?.after ?? fiveMajors.files[path]?.after ?? homeDouble.files[path]?.after ?? gOrders.files[path] ?? personalPhone.files[path] ?? phoneFormat.files[path]?.after ?? corporateContact.files[path]?.after ?? largeContact.files[path]?.after ?? finish.files[path]?.after ?? contact.files[path]?.after ?? selected.files[path]?.after ?? approved.files[path]?.after ?? sha256)) failures.push(`Afternoon source changed: ${path}`);
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
    ["sweet-spot authorization rebaseline", sweetPath, read(sweetPath) + "\n"],
    ["signup authorization rebaseline", signupPath, read(signupPath) + "\n"],
    ["logo authorization rebaseline", logoPath, read(logoPath) + "\n"],
    ["logo source rollback", path, original.replace("const logoMult = phoneViewport ? 2 : 3", "const logoMult = phoneViewport ? 1 : 1.5")],
    ["signup input re-excluded", path, original.replace('!element.matches("script, style")', '!element.matches("script, style, footer#footer .wild-signup-field input")')],
    ["heavy-medium authorization rebaseline", heavyPath, read(heavyPath) + "\n"],
    ["sweet-medium source rollback", path, original.replace("phoneViewport ? 1.5 : 2", "phoneViewport ? 1 : 1")],
    ["middle-ground authorization rebaseline", middlePath, read(middlePath) + "\n"],
    ["medium authorization rebaseline", mediumPath, read(mediumPath) + "\n"],
    ["large tier changed", path, original.replace("phoneViewport ? 2 : 3", "phoneViewport ? 1.25 : 3")],
    ["medium scope replaced by large sequence", path, original.replace('".wild-wildfire-build-note",', '".wild-wildfire-sequence-callout",')],
    ["five-page authorization rebaseline", fiveMajorsPath, read(fiveMajorsPath) + "\n"],
    ["mobile gap rollback", path, original.replace("phoneViewport ? 2 : 3", "phoneViewport ? 3 : 3")],
    ["missing Ruins final heading", path, original.replace(".wild-iscott-prompt--ruins-single .wild-iscott-prompt__ask", ".missing-ruins-heading")],
    ["second logo shadow painter", path, original.replace("drop-shadow(${homeConnectedTextShadow(offsetPx, large, control)})", "drop-shadow(${homeConnectedTextShadow(offsetPx, large, control)}) drop-shadow(0 1px 0 #000)")],
    ["Home double authorization rebaseline", homeDoublePath, read(homeDoublePath) + "\n"],
    ["Home stronger shadow rollback", path, original.replace("phoneViewport ? 2 : 3", "phoneViewport ? 2 : 1.5")],
    ["extra native shadow layer", path, original.replace("}px 0 #000", "}px 0 #000, 0 1px 0 #000")],
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
  console.log(`${cases.length} negative controls rejected. No source files were mutated.`);
} else {
  console.log(`Selected appearance plus explicit mobile contact correction matched: ${Object.keys(reference.files).length} protected reference files with explicit heading deltas, imported stylesheets, layout and npm hooks.`);
  console.log("This is restoration/drift evidence, not permission to redesign or a substitute for device review.");
}
