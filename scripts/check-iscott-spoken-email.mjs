import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/iscottLeadParsing.ts");
const source = await fs.readFile(sourcePath, "utf8");
const salesSource = await fs.readFile(path.resolve("src/lib/iscottSalesCopy.ts"), "utf8");
const salesOutput = ts.transpileModule(salesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const salesPath = path.resolve(".next/iscottSalesCopy.mjs");
await fs.mkdir(path.dirname(salesPath), { recursive: true });
await fs.writeFile(salesPath, salesOutput, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('from "./iscottSalesCopy"', 'from "./iscottSalesCopy.mjs"');
const tempPath = path.resolve(".next/iscott-spoken-email-check.mjs");
await fs.mkdir(path.dirname(tempPath), { recursive: true });
await fs.writeFile(tempPath, output, "utf8");
const {
  extractEmail,
  formatSpokenEmailForReadback,
  formatSpokenPhoneForReadback,
  iscottEmailReadbackPrompt,
  visitorChoseContactMethod,
  sendingToGCopy,
  sentToGCopy,
  classifyPublicInterest,
  identityBoundaryContext,
} = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);

const reconcileSource = await fs.readFile(path.resolve("src/lib/iscottLaunchReconcile.ts"), "utf8");
const reconcileOut = ts.transpileModule(reconcileSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
  .replace("./iscottLeadParsing", pathToFileURL(tempPath).href);
const reconcilePath = path.resolve(".next/iscott-launch-reconcile-check.mjs");
await fs.writeFile(reconcilePath, reconcileOut, "utf8");
const {
  classifyLeadReconcile,
  reportableReconcileRows,
  launchReconcileEnabled,
} = await import(`${pathToFileURL(reconcilePath).href}?v=${Date.now()}`);

const stored = "abc@example.com";
assert.equal(extractEmail(stored), stored);
assert.equal(formatSpokenEmailForReadback(stored), "a-b-c at e-x-a-m-p-l-e dot c-o-m");
assert.equal(extractEmail(stored), stored, "stored email is not mutated by readback");
assert.equal(
  formatSpokenEmailForReadback("sg-dietz@example.com"),
  "s-g dash d-i-e-t-z at e-x-a-m-p-l-e dot c-o-m",
);
assert.equal(
  formatSpokenEmailForReadback("jane.doe+test@mail.example.com"),
  "j-a-n-e dot d-o-e plus t-e-s-t at m-a-i-l dot e-x-a-m-p-l-e dot c-o-m",
);
assert.equal(formatSpokenEmailForReadback("not-an-email"), "");
assert.equal(formatSpokenPhoneForReadback("4105550101"), "4-1-0-5-5-5-0-1-0-1");
assert.equal(formatSpokenPhoneForReadback("12"), "");
assert.equal(formatSpokenEmailForReadback("a-b-c at e-x-a-m-p-l-e"), "");
assert.match(
  iscottEmailReadbackPrompt("abc@example.com"),
  /Your email address is a-b-c at e-x-a-m-p-l-e dot c-o-m/,
);
assert.equal(iscottEmailReadbackPrompt("partial@"), null);
assert.match(identityBoundaryContext(), /a-b-c at e-x-a-m-p-l-e dot c-o-m/);

assert.equal(visitorChoseContactMethod("Uh, email's fine."), "email");
assert.equal(visitorChoseContactMethod("phone"), "phone");
assert.equal(visitorChoseContactMethod("How should Scott reach out to you - email or phone?"), null);
assert.equal(visitorChoseContactMethod("Would you like email or phone?"), null);

assert.equal(sendingToGCopy(), "I'm sending that to G.");
assert.equal(sentToGCopy("email"), "Email sent to G ✓");
assert.equal(sentToGCopy("phone"), "Phone sent to G ✓");

const overlay = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
assert.match(overlay, /I'm sending that to Scott\./);
assert.match(overlay, /Email sent to Scott ✓/);
assert.match(overlay, /setCaptureHidden\(true\)/);
assert.match(overlay, /setCaptureHidden\(false\)/);
assert.match(overlay, /setSentVisible\(true, method\)/);
assert.match(overlay, /#wildworks-lead-spoken-readback/);
assert.match(overlay, /lead\.spokenReadback/);
assert.match(overlay, /revealCapturedContact\(output, visible\)/);

const captureSrc = await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8");
assert.match(captureSrc, /spokenReadback: method === "email" && raw \? formatSpokenEmailForReadback\(raw\)/);
assert.match(captureSrc, /method === "phone" && raw \? formatSpokenPhoneForReadback\(raw\) \|\| null : null/);
assert.match(captureSrc, /displayValue: display\?\.checkable \?\? raw/);
assert.match(captureSrc, /visitorChoseContactMethod/);

assert.equal(classifyPublicInterest(["I definitely, I'm interested in a website."]), "website");
assert.equal(classifyPublicInterest(["need some landscaping out back"]), "landscaping");
assert.equal(classifyPublicInterest(["hello"]), "none");

assert.equal(
  classifyLeadReconcile({
    sessionId: "s-public",
    trafficClass: "public",
    hasContact: true,
    contactMethod: "email",
    userTexts: ["I want a website"],
  }).kind,
  "missed_interest",
);
assert.equal(
  classifyLeadReconcile({
    sessionId: "s-fail",
    trafficClass: "public",
    hasContact: true,
    contactMethod: "email",
    notificationStatus: "failed",
    userTexts: ["website"],
  }).kind,
  "provider_failure",
);
assert.equal(
  classifyLeadReconcile({
    sessionId: "s-owner",
    trafficClass: "owner",
    hasContact: true,
    contactMethod: "email",
    userTexts: ["website"],
  }).kind,
  "excluded_owner_test",
);
const report = reportableReconcileRows([
  { sessionId: "s-public", trafficClass: "public", hasContact: true, contactMethod: "email", userTexts: ["website"] },
  { sessionId: "s-public", trafficClass: "public", hasContact: true, contactMethod: "email", userTexts: ["website"] },
  { sessionId: "s-owner", trafficClass: "owner", hasContact: true, contactMethod: "email", userTexts: ["website"] },
]);
assert.equal(report.length, 1, "duplicate public missed-interest is one alert");
assert.equal(launchReconcileEnabled({}), false);
assert.equal(launchReconcileEnabled({ ISCOTT_LAUNCH_RECONCILE_ENABLED: "true" }), true);
assert.match(JSON.stringify(report[0]), /"hasUsableContact":true/);
assert.doesNotMatch(JSON.stringify(report), /@/);

console.log("iScott spoken-email and launch-reconcile checks passed");
