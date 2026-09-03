// G's ride, Supabase session 7325f798, 2026-08-19 13:46. THE SECOND LEAD LOST
// THE SAME DAY, on a different path from b1dd603f.
//
// He said, in one breath: "Um, but yeah, so the email's correct. Send the email
// to Scott." That is an explicit instruction, and isSendCommandConsent read it
// as one. It was then thrown away, because the caller ALSO demanded that iScott
// had asked permission first. In that ride iScott never asked, and the only
// read-back he had done was of a MIS-HEARD address - S-G-D-I-E-Z - from before G
// corrected it, so it did not match the stored contact either. Both flags false.
//
// The row stayed at ready_for_confirmation, consent_status stayed "unknown", the
// auto-send condition was never met, and iScott said "Perfect! I'm sending that
// to Scott." G, on the recording: "it should fire immediately... it's been a
// full minute. And nothing."
//
// THE COMMAND IS THE CONSENT. Being asked first is one way to get consent, not
// the only way.
//
// This drives the REAL detector with G's REAL turns, in the real order, with
// the local part of his address redacted. It is not a source-shape check.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next");
await fs.mkdir(out, { recursive: true });
const url = (n) => "file:///" + path.join(out, `sk-${n}.mjs`).split(path.sep).join("/");
async function tr(rel, rw = []) {
  const n = path.basename(rel).replace(/\.ts$/, "");
  let o = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [a, b] of rw) o = o.replaceAll(a, b);
  await fs.writeFile(path.join(out, `sk-${n}.mjs`), o, "utf8");
  return `./sk-${n}.mjs`;
}
const sales = await tr("src/lib/iscottSalesCopy.ts");
await tr("src/lib/iscottLeadParsing.ts", [['from "./iscottSalesCopy"', `from "${sales}"`]]);
const P = await import(url("iscottLeadParsing"));

const VALUE = "redacted@pm.me";
let t = 1787161700;
const turn = (role, message) => ({ role, message, laAbsoluteTimestamp: (t += 2) });

// The shape of the real ride: a read-back of the WRONG address, G's correction,
// the corrected address with NO second read-back, then the direct command.
const rows = [
  turn("assistant", "Got it. Let me read that back to you: R-E-D-A-C-T at P-M dot M-E. Did I hear that exactly right?"),
  turn("user", "No, that's not right. It's R-E-D-A-C-T-E-D."),
  turn("assistant", "Got it - that one's wrong. Say it again for me, slowly."),
  turn("user", "Okay, but I'm going to do the whole thing again now just for this."),
  turn("user", "Experiment. redacted@pm.me."),
  turn("user", "Okay, and then you're supposed to say, is that correct?"),
  turn("user", "Um, but yeah, so the email's correct. Send the email to Scott."),
];

assert.equal(P.isSendCommandConsent("Um, but yeah, so the email's correct. Send the email to Scott."), true,
  "the direct instruction must read as a send command on its own");

assert.equal(P.detectsContextualContactSendConfirmation(rows, "email", VALUE), true,
  "an explicit send command must grant consent even when iScott never asked and never read the address back");

// Negation must still win outright - this is the whole reason the gate felt safe.
const refuse = [turn("assistant", "May I send these details to Scott?"), turn("user", "No, don't send my information to Scott.")];
assert.equal(P.isSendCommandConsent("No, don't send my information to Scott."), false,
  "negation must never register as consent");
assert.equal(P.detectsContextualContactSendConfirmation(refuse, "email", VALUE), false,
  "a refusal after a prompt must not grant consent");

// A bare "yes" with nothing asked must still NOT be consent - that path is untouched.
const bare = [turn("assistant", "Scott has built gardens all over Baltimore."), turn("user", "Yes.")];
assert.equal(P.detectsContextualContactSendConfirmation(bare, "email", VALUE), false,
  "a plain yes with no question asked must still not grant consent");

// Explaining the permission process is not the permission itself.
assert.equal(P.isSendCommandConsent("People have to give their permission first, then that fires the send to Scott."), false,
  "a policy explanation must not be mistaken for the visitor's command");
assert.equal(P.isSendCommandConsent("You need my permission before you send it to Scott."), false,
  "stating the prerequisite must not satisfy it");
assert.equal(P.isSendCommandConsent("You have my permission. Send it to Scott."), true,
  "an actual first-person permission plus command must remain consent");

console.log("OK - the command is the consent; refusals and bare affirmations unchanged.");
