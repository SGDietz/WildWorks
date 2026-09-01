/**
 * iScott reads a phone number back in WORDS, and nothing could read it.
 *
 * G's ride 2026-08-31 15:20:
 *   [5] USER      Yes. 443-797-2166.
 *   [6] ASSISTANT Got it. That's four four three, seven nine seven, two one
 *                 six six. Did I hear that exactly right?
 *   [7] USER      You did.
 *
 * The exact-contact check compares digits and strips everything else, so that
 * read-back reduced to "" and the consent walk refused with
 * no_exact_contact_readback. The lead kept his phone number and Scott was
 * never told. Every phone lead failed this way.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const transpile = async (rel, outName, replace) => {
  let out = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  if (replace) out = out.split(replace[0]).join(replace[1]);
  const target = path.resolve(`.next/${outName}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, out, "utf8");
  return target;
};
await transpile("src/lib/iscottSalesCopy.ts", "phoneword-sales.mjs");
const p = await transpile("src/lib/iscottLeadParsing.ts", "phoneword-parsing.mjs", [
  'from "./iscottSalesCopy"', 'from "./phoneword-sales.mjs"',
]);
const m = await import(pathToFileURL(p).href);

const runsInclude = (text, digits) => m.spokenDigitRuns(text).some((r) => r.includes(digits));

/* ------------------------------------------------- the spoken forms ---- */
for (const [spoken, digits] of [
  ["four four three, seven nine seven, two one six six", "4437972166"],
  ["four-four-three seven-nine-seven two-one-six-six",   "4437972166"],
  ["443 seven nine seven 2166",                          "4437972166"],
  ["double four three seven nine seven two one six six", "4437972166"],
  ["nine one one",                                       "911"],
  ["five five five oh one four two",                     "5550142"],
  ["five five five zero one four two",                   "5550142"],
  ["triple seven one two three four",                    "7771234"],
]) {
  assert.ok(runsInclude(spoken, digits), `"${spoken}" should yield ${digits}`);
}

/* ------------------------------------------- the real ride-15:20 turn --- */
const READBACK = "Got it. That's four four three, seven nine seven, two one six six. Did I hear that exactly right?";
assert.ok(m.isExactContactReadback(READBACK, "phone", "4437972166"),
  "the real ride 15:20 read-back must register as an exact read-back");

/* ---------------------------------------------------- SAFETY: no false --- */
// A different number in words must NOT match. A false positive here mails a
// stranger's details to Scott.
assert.equal(
  runsInclude("four four three, seven nine seven, two one six seven", "4437972166"),
  false, "a different spoken number must not match");
assert.equal(
  m.isExactContactReadback(
    "Got it. That's four four three, seven nine seven, two one six seven. Did I hear that exactly right?",
    "phone", "4437972166"),
  false, "a read-back of a different number must not register");

// An unknown word ends a run, so digits either side never fuse into a number
// nobody spoke.
assert.equal(runsInclude("four four three. Scott, seven nine seven two one six six", "4437972166"),
  false, "digits split by a sentence must not fuse");

// The digit path still works untouched.
assert.ok(m.isExactContactReadback(
  "Got it. That's 443-797-2166. Did I hear that exactly right?", "phone", "4437972166"),
  "the plain digit read-back must still register");

// Email is untouched.
assert.ok(m.isExactContactReadback(
  "Got it! That's S-G-D-I-E-T-Z at P-M dot M-E. Did I hear that exactly right?",
  "email", "sgdietz@pm.me"), "the spelled email read-back must still register");

/* ------------------------------- the whole ride-15:20 gate, end to end --- */
// A read-back in words, a confirmation, two turns of ordinary digression, then
// an explicit send command. This is the exact shape that lost the lead.
const u = (message) => ({ role: "user", message, laAbsoluteTimestamp: null });
const a = (message) => ({ role: "assistant", message, laAbsoluteTimestamp: null });
const ride1520 = [
  a("It sounds like you'd prefer to be contacted by text. Could you please provide me with your phone number?"),
  u("Yes. 443-797-2166."),
  a(READBACK),
  u("You did."),
  u("The text is super small though. It's like midget size. It's like ridiculously small."),
  u("God damn it."),
  u("Yes, send that to Scott. You have my permission."),
];
const gate = m.evaluateExactContactSendConsent(ride1520, "phone", "4437972166");
assert.equal(gate.consented, true,
  `ride 15:20 must consent end to end, got ${gate.reason}`);

// And the same ride with a DIFFERENT number spoken before the command must not.
const wrong = m.evaluateExactContactSendConsent(
  [...ride1520.slice(0, 6), u("Actually use four four three, five five five, one two one two."),
   u("Yes, send that to Scott.")],
  "phone", "4437972166");
assert.equal(wrong.consented, false,
  "a number change before the send command must still block consent");

console.log("check-iscott-phone-word-readback: OK");
