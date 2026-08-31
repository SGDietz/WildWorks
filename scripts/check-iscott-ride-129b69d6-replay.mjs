/**
 * Replay of G's ride 129b69d6 (2026-08-31 09:19 ET), the one that reached him
 * as an "INCOMPLETE iScott lead" carrying the name "Information".
 *
 * Two independent faults, both asserted here:
 *   1. extractSpokenNameAndPlace read "...more information from me," as a name
 *      and the capture layer replaced the real name with it.
 *   2. detectsContactReadBackCorrect refused every natural confirmation, so
 *      consent never locked and the package never qualified.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const transpile = async (rel, outName, replace) => {
  const source = await fs.readFile(path.resolve(rel), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  if (replace) output = output.replace(replace[0], replace[1]);
  const target = path.resolve(`.next/${outName}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
  return target;
};

await transpile("src/lib/iscottSalesCopy.ts", "ride129-sales.mjs");
const parsingPath = await transpile("src/lib/iscottLeadParsing.ts", "ride129-parsing.mjs", [
  'from "./iscottSalesCopy"',
  'from "./ride129-sales.mjs"',
]);
const m = await import(pathToFileURL(parsingPath).href);

/* ---------------------------------------------------------------- FAULT 1 */
// The exact sentence that poisoned the name. It must yield nothing.
assert.equal(
  m.extractSpokenFullName("I mean, you could have gotten more information from me, but it's, you know, about all the "),
  null,
  "the sentence that produced 'Information' must no longer yield a name",
);
assert.equal(
  m.extractSpokenNameAndPlace("you could have gotten more information from me, but it's").name,
  null,
  "a mid-sentence '<word> from <word>' is not an introduction",
);
// A pronoun is never a place, wherever it appears.
for (const pronoun of ["me", "you", "us", "them", "him", "her"]) {
  assert.equal(
    m.extractSpokenNameAndPlace(`Scott from ${pronoun}.`).location,
    null,
    `"${pronoun}" must never be stored as a location`,
  );
}
// The bare form still has to work - it is how people answer "what's your name?"
assert.equal(m.extractSpokenNameAndPlace("Scott from Timonium.").name, "Scott");
assert.equal(m.extractSpokenNameAndPlace("Scott from Timonium.").location, "Timonium");
assert.equal(m.extractSpokenFullName("Uh, my name is Scott.").name ?? m.extractSpokenFullName("Uh, my name is Scott."), "Scott");
// Cued forms keep matching anywhere in the turn.
assert.equal(m.extractSpokenNameAndPlace("Yeah so my name is Dave from Baltimore.").name, "Dave");
assert.equal(m.extractSpokenNameAndPlace("Yeah so my name is Dave from Baltimore.").location, "Baltimore");

/* ---------------------------------------------------------------- FAULT 2 */
// G's actual confirmation, verbatim from the transcript.
assert.equal(
  m.detectsContactReadBackCorrect("But yes, you, you said it correctly."),
  true,
  "G's own confirmation must register",
);
for (const yes of [
  "Yes, that's correct.",
  "That's right.",
  "Correct.",
  "You got it right.",
  "You read it right.",
  "That's it.",
  "Exactly right.",
  "Yep, spot on.",
  "you said it right",
  "email is correct",            // the original shape, must still pass
  "that's the right number",     // the original shape, must still pass
]) {
  assert.equal(m.detectsContactReadBackCorrect(yes), true, `should confirm: ${yes}`);
}
// A correction must NEVER read as a confirmation. These are the dangerous ones -
// several contain the very words the positive patterns look for.
for (const no of [
  "No, that's not right.",
  "That's incorrect.",
  "No.",
  "Not correct.",
  "That isn't right.",
  "Nope, wrong.",
  "Almost right.",
  "That's not the right number.",
  "no the email is correct is what I would say if it were",
]) {
  assert.equal(m.detectsContactReadBackCorrect(no), false, `must NOT confirm: ${no}`);
}

/* ------------------------------------------------- the whole ride, in order */
const RIDE_USER_LINES = [
  "Uh, my name is Scott.",
  "sgdietz@pm.me.",
  "You did. That's super small text. I can barely see it though.",
  "But yes, you, you said it correctly.",
  "Yes.",
  "The, um, the text on the inside",
  "Oh, I did. I just got an email.",
  "I got the email.",
  "But I'm seeing a confirmation on screen right now, and the text might",
  "my email address, the email address needs to be a size appropriate to the box.",
  "Like a super long email address may be smaller text.",
  "I mean, you could have gotten more information from me, but it's, you know, about all the ",
  "to upload any information about the project.",
  "But I did get the email.",
];
const names = RIDE_USER_LINES.map((t) => m.extractSpokenFullName(t)).filter(Boolean);
assert.deepEqual(names, ["Scott"], `the ride must yield exactly one name, got ${JSON.stringify(names)}`);
assert.ok(
  RIDE_USER_LINES.some((t) => m.detectsContactReadBackCorrect(t)),
  "the ride must contain a recognised read-back confirmation",
);

console.log("iScott ride 129b69d6 replay passed: one name ('Scott'), read-back confirmed, refusals still refused.");

/* ------------------------------------------------- ride 009124c0, 2026-08-31 */
// He confirmed the read-back and gave an explicit send command, and the lead
// still did not go:
//   15:21:26  iScott: "...two one six six. Did I hear that exactly right?"
//   15:21:27  G:      "You did."
//   15:21:55  G:      "Yes, send that to Scott. You have my permission."
// consent_status stayed "unknown". The send command HAD registered; the
// read-back gate had not, so consent could never lock.
assert.equal(
  m.detectsContactReadBackCorrect("You did."),
  true,
  "'You did.' is the natural answer to 'did I hear that right?' and must confirm",
);
for (const yes of ["You did", "Yes, you did.", "Yeah you did", "You do", "You have."]) {
  assert.equal(m.detectsContactReadBackCorrect(yes), true, `should confirm: ${yes}`);
}
// The auxiliary echo must not swallow a refusal that starts the same way.
for (const no of ["You did not.", "You didn't.", "No, you did not get that right."]) {
  assert.equal(m.detectsContactReadBackCorrect(no), false, `must NOT confirm: ${no}`);
}

// A plain imperative is consent. Someone telling you to do a thing has
// consented to the thing.
for (const cmd of [
  "send that to Scott",
  "Yes, send that to Scott. You have my permission.",
  "send it to Scott",
  "forward that to Scott",
  "you have my permission",
]) {
  assert.equal(m.isSendCommandConsent(cmd), true, `should be consent: ${cmd}`);
}
for (const cmd of ["don't send that to Scott", "do not send my info", "never send that to Scott"]) {
  assert.equal(m.isSendCommandConsent(cmd), false, `must NOT be consent: ${cmd}`);
}

console.log("iScott ride 009124c0 replay passed: 'You did.' confirms, bare send command is consent, refusals still refused.");
