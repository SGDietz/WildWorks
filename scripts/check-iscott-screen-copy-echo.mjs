/**
 * 2026-09-01. Two faults, both found by replaying G's ride 3414643a (03:13 ET),
 * the one where the lead box refused him over and over at 3am.
 *
 * FAULT 1 - THE ECHO TRAP.
 *   The confirm route refused the send and printed its own words on screen:
 *   "iScott still needs to hear, in your own words, what you want Scott to help
 *   with - say that, then choose Send to Scott again."
 *   G read the box out loud to ask what it meant. PROJECT_NEED_PATTERNS matched
 *   OUR OWN COPY inside his reading of it and stored it as his project need. The
 *   gate refused that as generic, printed the same box again, and the trap
 *   closed - every attempt to ask about the error re-armed the error.
 *
 * FAULT 2 - THE NINE-WORD FILLER LIST.
 *   iScott asked "May Scott contact you at that email address?" and G said
 *   "Perfect. Yes." It registered as NOTHING, because the filler list in front
 *   of the yes token was nine words and "perfect" was not one of them. Three of
 *   his last four leads died holding his real address on this.
 *
 * Both are asserted against the real transcript, not a paraphrase.
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

await transpile("src/lib/iscottSalesCopy.ts", "echo-sales.mjs");
const parsingPath = await transpile("src/lib/iscottLeadParsing.ts", "echo-parsing.mjs", [
  'from "./iscottSalesCopy"',
  'from "./echo-sales.mjs"',
]);
const m = await import(pathToFileURL(parsingPath).href);

/* ------------------------------------------------------------------ FAULT 1 */
// The exact sentence G spoke, transcribed. It must yield NO project need.
const SPOKEN_ECHO =
  "Okay, it said there's a box that says nothing has been sent. iScott still needs to hear in your own words what the what you want Scott to help with, say that, then choose Send to Scott again.";
assert.equal(
  m.extractProjectNeed(SPOKEN_ECHO),
  null,
  "the refusal box, read out loud, must never become the project need",
);
assert.equal(m.isAppScreenCopyEcho(SPOKEN_ECHO), true);

// Every other line of our own copy, spoken back, is equally not a project need.
for (const line of [
  "It says the send failed. Scott does not have this yet. I will keep the details here.",
  "It says nothing has been sent, iScott still needs your name.",
  "There's a box saying iScott has not read that back to you and heard you confirm it yet.",
  "It says nothing has been sent, iScott still needs a way for Scott to reach you.",
  "Now it says your details changed after you gave permission.",
  "It says that email address does not look complete, please correct it.",
]) {
  assert.equal(m.isAppScreenCopyEcho(line), true, `screen copy not recognised: ${line}`);
  assert.equal(m.extractProjectNeed(line), null, `screen copy became a need: ${line}`);
}

// ...and ordinary speech must NOT trip the firewall. A firewall that eats real
// answers is worse than the trap it replaces.
for (const line of [
  "I want a waterfall and a stone patio out back.",
  "Can he help me build my brand?",
  "I need a new website and a logo.",
  "We'd like a cascading stream and a fire pit.",
  "Send me the details when you can.",
  "I'll send Scott some photos of the yard.",
]) {
  assert.equal(m.isAppScreenCopyEcho(line), false, `ordinary speech tripped the firewall: ${line}`);
}

// G's REAL answer, in his first breath of that ride. "help" was missing from
// the question pattern, which is why the slot was still empty for the echo.
const REAL = "Scott Builds Digital Brands, and he, um, Uh, can he help me build my brand?";
assert.equal(m.extractProjectNeed(REAL), "Help me build my brand");
assert.equal(m.isSpecificProjectNeed("Help me build my brand"), true);

// A qualifying need is never traded away for a longer non-qualifying one.
assert.equal(
  m.preferProjectNeed("A waterfall and a stone patio", "Help with, say that, then choose Send to Scott again"),
  "A waterfall and a stone patio",
  "a real need must survive a longer piece of junk",
);

// End to end over the whole ride: the visitor pool must yield his real answer.
const RIDE_USER_TURNS = [
  "Scott Builds Digital Brands, and he, um, Uh, can he help me build my brand?",
  "Let me I need help.",
  "Reach out to me. I'd like to discuss it with him.",
  "Um, Email's great.",
  "Uh, my name is Scott.",
  "sgdietz@pm.me.",
  "You did.",
  "Perfect. Yes.",
  "No. You know, did you send the email? I didn't, you know, I didn't",
  "I didn't see you sent it, or— and I didn't receive an email.",
  SPOKEN_ECHO,
  "That doesn't make any sense. And the And then your email.",
  "So it says, um, send.",
  "These details to Scott. The send failed. Scott does not have this yet. I will keep the details here.",
  "What's all that mean?",
];
assert.equal(
  m.visitorProjectNeedFromRows(RIDE_USER_TURNS).projectNeed,
  "Help me build my brand",
  "the ride must end holding G's real answer, not the error box",
);

/* ------------------------------------------------------------------ FAULT 2 */
// The words G actually used, and the shapes people actually use.
for (const yes of [
  "Perfect. Yes.",
  "Perfect, yes.",
  "Perfect! Yes.",
  "Great, yes.",
  "Awesome. Yes.",
  "Cool, yeah.",
  "Nice, yep.",
  "Excellent, yes please.",
  "Sounds good, yes.",
  "Got it, yes.",
  "Thanks, yes.",
  "Yes.",
  "Yep",
]) {
  assert.equal(m.detectsSimpleAffirmation(yes), true, `a real yes was refused: ${yes}`);
}

// THE SAFETY SIDE. Widening what may sit in front of a yes must not widen what
// counts AS a yes. Every one of these opens with the new filler and is not
// consent - if any passes, the fix manufactures permission nobody gave.
for (const notYes of [
  "Perfect. No.",
  "Perfect, not yet.",
  "Great, but hold on.",
  "Awesome, yeah, but wait.",
  "Perfect. Yeah, but hold on.",
  "Cool, yes, actually no.",
  "Nice, yes, but only if Scott calls first.",
  "Sounds good, but don't send it yet.",
  "Great. Stop.",
  "Perfect, yes, unless it costs anything.",
]) {
  assert.equal(m.detectsSimpleAffirmation(notYes), false, `this became consent and must not: ${notYes}`);
}

console.log("check-iscott-screen-copy-echo: OK");
