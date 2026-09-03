// Frozen regression for G's 2026-09-02 vertical-iPad ride. Local only: no
// Supabase writes, provider calls, email sends, browser session, or runtime.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = await fs.readFile("src/lib/iscottLeadParsing.ts", "utf8");
const salesSource = await fs.readFile("src/lib/iscottSalesCopy.ts", "utf8");
const out = path.resolve(".next", "iscott-b0c50885-replay");
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "iscottSalesCopy.mjs"), ts.transpileModule(salesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText, "utf8");
await fs.writeFile(path.join(out, "iscottLeadParsing.mjs"), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replaceAll('from "./iscottSalesCopy"', 'from "./iscottSalesCopy.mjs"'), "utf8");
const Parsing = await import(`${pathToFileURL(path.join(out, "iscottLeadParsing.mjs")).href}?v=${Date.now()}`);

const email = "owner@example.com";
const nameQuestion = "I haven't captured your name yet. Could you please share your name with me?";
const ride = [
  { role: "user", message: "I want Scott to reach out to me, help me build my brand.", laAbsoluteTimestamp: 1788355543 },
  { role: "assistant", message: `I have your email as ${email}. Did I hear that exactly right?`, laAbsoluteTimestamp: 1788355602 },
  { role: "user", message: "You did.", laAbsoluteTimestamp: 1788355604 },
  { role: "assistant", message: "May Scott contact you at that email address about this project?", laAbsoluteTimestamp: 1788355608 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 1788355610 },
  { role: "assistant", message: nameQuestion, laAbsoluteTimestamp: 1788355623 },
  { role: "user", message: "Scott. And the box? was off the screen for— was there any kind of confirmation?", laAbsoluteTimestamp: 1788355626 },
];

assert.equal(
  Parsing.extractSpokenFullName(ride.at(-1).message, nameQuestion),
  "Scott",
  "the direct bare-name answer survives trailing iPad commentary",
);

const chronology = Parsing.evaluateLeadPackageChronology({
  rows: ride,
  fullName: "Scott",
  projectNeed: "Scott to reach out to me, help me build my brand",
  contactMethod: "email",
  contactValue: email,
});
assert.equal(chronology.permissionCurrent, true, "permission for the confirmed contact survives a later recovered name");
assert.deepEqual(chronology.staleFields, [], "a late name is not a consent-material package change");

const qualification = Parsing.evaluateIScottLeadSendQualification({
  fullName: "Scott",
  projectNeed: "Scott to reach out to me, help me build my brand",
  contactMethod: "email",
  contactValue: email,
  consentStatus: "accepted",
  contactConfirmedAt: "2026-09-02T13:27:12.000Z",
  rows: ride,
});
assert.equal(qualification.qualified, true, "the recovered name completes the already-authorized contact package");

const route = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");
assert.match(route, /const parentIsPortraitTablet = \(\) =>/, "the embed gate reads the same-origin parent dimensions");
assert.match(route, /parentWidth >= 521 && parentWidth <= 1279 && parentHeight > parentWidth/, "existing tablet portrait bounds are applied to the parent viewport");
assert.doesNotMatch(route, /const outerTabletPortrait = "\(pointer: coarse\)/, "desktop-mode iPad activation does not depend on pointer identity");
assert.match(route, /logUi\("iscott_embed_geometry"/, "the first visible lead composition emits geometry evidence");
for (const field of ["visualViewport", "parentFrame", "finish", "panel", "card", "measured"]) {
  assert.match(route, new RegExp(`\\b${field}\\b`), `geometry evidence includes ${field}`);
}

console.log("iScott b0c50885 vertical-iPad replay check OK.");
