/**
 * The consent gate, 2026-08-31 night.
 *
 * Three of G's last four rides captured his address and never sent Scott
 * anything. He noticed: "I did not receive a confirmation email which you were
 * supposed to send."
 *
 * Cause, measured by replaying the real transcripts: the send prompt is only
 * "anchored" if iScott's read-back happened within READBACK_TO_PROMPT_MAX_TURNS
 * user turns of it. G confirms the read-back and then talks about the UI for
 * several turns before iScott asks to send, so the read-back aged out and the
 * yes was discarded as readback_too_far_from_prompt.
 *
 * Fix: a visitor turn that states the read-back was correct re-anchors it.
 * Distance from a read-back is only a proxy for "could the value have gone
 * stale"; the visitor answering that question directly resets it.
 *
 * These are the real turn sequences from the rides, trimmed to the gate.
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
await transpile("src/lib/iscottSalesCopy.ts", "reanchor-sales.mjs");
const p = await transpile("src/lib/iscottLeadParsing.ts", "reanchor-parsing.mjs", [
  'from "./iscottSalesCopy"',
  'from "./reanchor-sales.mjs"',
]);
const m = await import(pathToFileURL(p).href);

const EMAIL = "sgdietz@pm.me";
const u = (message) => ({ role: "user", message, laAbsoluteTimestamp: null });
const a = (message) => ({ role: "assistant", message, laAbsoluteTimestamp: null });
const READBACK = a("Got it! That's S-G-D-I-E-T-Z at P-M dot M-E. Did I hear that exactly right?");
const SEND_PROMPT = a("Got it! Just to confirm, may I send these details to Scott now?");

/* ---- G's ride 17:32. Seven turns of UI feedback between the two. ---- */
const ride1732 = [
  a("Thanks, Scott! What's your email address?"),
  u("sgdietz@pm.me."),
  READBACK,
  u("You did, and you said it perfectly. That's great. But the, the lettering is so small. It needs to be much bigger."),
  u("Um, but we gotta be careful."),
  u("When the people have long email addresses, that it's not that it's appropriate to the size."),
  u("Nicely, it like take up like 3/4 of the space."),
  u("Inside the box."),
  u("So if they have a really long email address, it should be smaller text."),
  u("Yes, that is correct, iScott."),
  SEND_PROMPT,
  u("Yes."),
];
const r1732 = m.evaluateExactContactSendConsent(ride1732, "email", EMAIL);
assert.equal(r1732.consented, true,
  `ride 17:32 must consent, got ${r1732.reason}`);

/* ---- G's ride 13:19. Confirmation split across two turns. ---- */
const ride1319 = [
  a("Thank you, Scott. What's your email address?"),
  u("sgdietz@pm.me."),
  READBACK,
  u("You did. That's super small text. I can barely see it though."),
  u("But yes, you, you said it correctly."),
  a("May I send these details to Scott?"),
  u("Yes."),
];
assert.equal(m.evaluateExactContactSendConsent(ride1319, "email", EMAIL).consented, true,
  "ride 13:19 must consent");

/* ---- G's ride f1163ff3, 2026-09-02. ----
 * The first affirmative re-anchors the exact read-back. The later explicit
 * command remains attached to that undenied read-back without an arbitrary
 * turn cap; confirming spelling alone still is not permission to transmit.
 */
const rideF1163 = [
  u("sgdietz@pm.me."),
  READBACK,
  u("Yes, perfect. And you sent it back. Perfect."),
  a("How should Scott reach out to you? Would you prefer email or a phone call?"),
  u("Yes, email."),
  a("Understood. I have your email."),
  u("The email box is still up."),
  u("The envelope needs to be bigger."),
  u("No glow."),
  u("The box needs to be shorter."),
  u("Reduce the shadow on Finish."),
  u("Send the email to Scott."),
];
const f1163 = m.evaluateExactContactSendConsent(rideF1163, "email", EMAIL);
assert.equal(f1163.consented, true, `f1163ff3 must consent, got ${f1163.reason}`);
assert.ok(
  m.evaluateExactContactSendConsent(rideF1163.slice(0, 2), "email", EMAIL).consented === false,
  "f1163ff3 must not consent before the visitor affirms the read-back",
);
assert.equal(m.detectsContactReadBackCorrect("Yes, perfect. And you sent it back. Perfect."), true);

const agedCommand = m.evaluateExactContactSendConsent([
  READBACK,
  u("You did."),
  ...Array.from({ length: 12 }, (_, index) => u(`Unrelated layout comment ${index}.`)),
  u("Send the email to Scott."),
], "email", EMAIL);
assert.equal(agedCommand.consented, true, "explicit send command must not expire after an undenied read-back");

/* ---- THE SAFETY SIDE. Re-anchoring must never invent permission. ---- */

// 1. A confirmation with no read-back behind it anchors nothing.
assert.equal(
  m.evaluateExactContactSendConsent(
    [a("What's your email address?"), u("sgdietz@pm.me."),
     u("You did, that's correct."), SEND_PROMPT, u("Yes.")],
    "email", EMAIL).consented,
  false,
  "a confirmation with no read-back must not anchor a prompt");

// 2. A different address spoken after the read-back kills it, and a later
//    confirmation must not resurrect the old one.
const changed = m.evaluateExactContactSendConsent(
  [READBACK, u("You did."), u("Actually use scott@wildworks.ai instead."),
   u("Yes, that is correct."), SEND_PROMPT, u("Yes.")],
  "email", EMAIL);
assert.equal(changed.consented, false,
  "consent must not survive the visitor changing the address");

// 3. A REFUSAL must not re-anchor. "No, that's not right" is not a confirmation.
const refused = m.evaluateExactContactSendConsent(
  [READBACK, u("No, that's not right at all."),
   u("The text is too small."), u("And the box is too dark."),
   SEND_PROMPT, u("Yes.")],
  "email", EMAIL);
assert.equal(refused.consented, false,
  "a refused read-back must not re-anchor the prompt");

// 4. The ride that already worked must keep working.
assert.equal(
  m.evaluateExactContactSendConsent(
    [READBACK, u("You did."), SEND_PROMPT, u("Yes.")], "email", EMAIL).consented,
  true,
  "the adjacent case must still pass");

console.log("check-iscott-readback-reanchor: OK");
