// G's ride, Supabase session b1dd603f, 2026-08-19 16:39. THIS COST A LEAD.
//
// iScott asked "Perfect! May I send these details to Scott?" and G answered
// "Yes." Nothing was sent. The row stayed at ready_for_confirmation with
// consent_status "unknown" and contact_confirmed_at null, so the auto-send
// condition was never met - and iScott then told him "Scott has your details and
// will follow up", claiming a send he had not earned.
//
// The cause was a rule that contradicted itself. isDirectContactSendPrompt's
// asksSendNow pattern deliberately accepts "these details" as valid phrasing,
// and the line below it then demanded the same message ALSO name the address or
// contain the literal word "email". A clear question followed by a clear yes
// registered as nothing at all.
//
// This drives the REAL detector with G's REAL turns. It is not a source-shape
// check - it calls the function and asserts what it decides.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next");
await fs.mkdir(out, { recursive: true });
const url = (n) => "file:///" + path.join(out, `sc-${n}.mjs`).split(path.sep).join("/");
async function tr(rel, rw = []) {
  const n = path.basename(rel).replace(/\.ts$/, "");
  let o = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [a, b] of rw) o = o.replaceAll(a, b);
  await fs.writeFile(path.join(out, `sc-${n}.mjs`), o, "utf8");
  return `./sc-${n}.mjs`;
}
const sales = await tr("src/lib/iscottSalesCopy.ts");
await tr("src/lib/iscottLeadParsing.ts", [['from "./iscottSalesCopy"', `from "${sales}"`]]);
const P = await import(url("iscottLeadParsing"));

// Redacted local part; the detector only cares about the shape and the domain.
const VALUE = "redacted@pm.me";
const READBACK = "Thank you! Let me spell that out to make sure I have it right: R-E-D-A-C-T-E-D at P-M dot M-E. Did I hear that exactly right?";

const ride = [
  { role: "assistant", message: READBACK, laAbsoluteTimestamp: 1000 },
  { role: "user", message: "Yes, you did.", laAbsoluteTimestamp: 1002 },
  { role: "assistant", message: "Perfect! May I send these details to Scott?", laAbsoluteTimestamp: 1004 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 1006 },
];

// 1. THE ONE THAT COST THE LEAD. A send prompt that says "these details" instead
//    of repeating the address, answered with a bare yes, IS consent.
assert.equal(
  P.detectsContextualContactSendConfirmation(ride, "email", VALUE),
  true,
  'iScott asking "May I send these details to Scott?" and the visitor saying "Yes." must register as consent',
);

// 2. The same, phrased the other ways the brain is allowed to use.
for (const ask of [
  "Would you like me to send it to Scott?",
  "Should I send your details to Scott?",
  "Do you want me to send these details to the WildWorks team?",
]) {
  assert.equal(
    P.detectsContextualContactSendConfirmation(
      [{ role: "assistant", message: ask, laAbsoluteTimestamp: 10 },
       { role: "user", message: "Yes.", laAbsoluteTimestamp: 12 }],
      "email", VALUE),
    true,
    `"${ask}" + yes must register as consent`,
  );
}

// 3. It must NOT fire without a send prompt. A yes to something else is not
//    permission to mail a stranger's details to Scott.
assert.equal(
  P.detectsContextualContactSendConfirmation(
    [{ role: "assistant", message: "Is this your own place?", laAbsoluteTimestamp: 10 },
     { role: "user", message: "Yes.", laAbsoluteTimestamp: 12 }],
    "email", VALUE),
  false,
  "a yes to an unrelated question is not send consent",
);

// 4. And the bare affirmation itself still has to be a real yes.
assert.equal(P.detectsSimpleAffirmation("Yes."), true, "a bare Yes. is an affirmation");

console.log("iScott send-consent check OK - the b1dd603f phrasing now registers.");
