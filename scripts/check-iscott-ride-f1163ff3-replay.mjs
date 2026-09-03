/**
 * Privacy-safe replay of G's 2026-09-02 iScott ride f1163ff3.
 * Production parser/UI-method code runs; the contact value is RFC-reserved and
 * no network, Supabase, provider, or email call occurs.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import rows from "./fixtures/iscott-f1163ff3-transcript-snapshot.mjs";

const out = path.resolve(".next", "iscott-f1163-replay");
await fs.mkdir(out, { recursive: true });
const transpile = async (rel, name, rewrites = []) => {
  let source = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  const target = path.join(out, `${name}.mjs`);
  await fs.writeFile(target, source, "utf8");
  return pathToFileURL(target).href;
};

await transpile("src/lib/iscottSalesCopy.ts", "sales");
const parsingUrl = await transpile("src/lib/iscottLeadParsing.ts", "parsing", [
  ['from "./iscottSalesCopy"', 'from "./sales.mjs"'],
]);
const uiUrl = await transpile("src/lib/iscottLeadCaptureUi.ts", "ui");
const P = await import(parsingUrl);
const UI = await import(uiUrl);

const EMAIL = "visitor@example.com";
assert.equal(rows.length, 67, "guard must replay the complete stored transcript_snapshot, not a hand-picked subset");

const user = rows.filter((row) => row.role === "user").map((row) => row.message);
assert.deepEqual(
  user.map((text) => P.extractSpokenFullName(text)).filter((name) => P.isMeaningfulVisitorName(name)),
  [],
  "'That's what I'm thinking' must not manufacture a meaningful visitor name",
);
assert.equal(P.extractProjectNeed("To build brands."), "To build brands");
assert.equal(P.isSpecificProjectNeed(P.extractProjectNeed("To build brands.")), true);
assert.equal(UI.visitorChoseContactMethod("Okay, the box, the— your phone. Where did your phone come from?"), null);
assert.equal(UI.visitorChoseContactMethod("I said email. I said, have him reach out by email."), "email");
assert.equal(user.some((text) => UI.visitorChoseContactMethod(text) === "phone"), false);
assert.equal(P.detectsContactReadBackCorrect("Yes, perfect. And you sent it back. Perfect."), true);
const readbackConfirmationIndex = rows.findIndex((row) => row.message === "Yes, perfect. And you sent it back. Perfect.");
assert.ok(readbackConfirmationIndex > 0, "the stored read-back confirmation must be present");
assert.equal(P.evaluateExactContactSendConsent(rows.slice(0, readbackConfirmationIndex), "email", EMAIL).consented, false);
const consent = P.evaluateExactContactSendConsent(rows, "email", EMAIL);
assert.equal(consent.consented, true, `explicit command after undenied read-back must send: ${consent.reason}`);
assert.equal(consent.reason, "send_command");

console.log("iScott ride f1163ff3 replay OK: no junk name/phone flip, project captured, read-back anchored, explicit send accepted.");
