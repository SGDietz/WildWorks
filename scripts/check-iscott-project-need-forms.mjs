/**
 * "What do you need?" - the shapes people actually answer in.
 *
 * extractProjectNeed used to run one pattern: I/we + want|need|would like|am
 * looking. Contractions were not in it, so the two commonest spoken forms in
 * English - "I'd like" and "I'm looking" - both returned null, and so did a
 * bare answer ("Him to build my brand") and a plain imperative ("Build me a
 * website"). Two of G's four rides on 2026-08-31 captured his address and
 * locked consent and still could not qualify, because the job was never
 * extracted from a sentence that plainly stated it.
 *
 * G, on being shown that: "yes, loosen it."
 *
 * Loosening the EXTRACTOR is the safe half. isSpecificProjectNeed still runs on
 * whatever comes out and still refuses generic text, coaching answers, contact
 * mechanics and operator sales language - the second half of this file proves
 * that is still true.
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
await transpile("src/lib/iscottSalesCopy.ts", "needforms-sales.mjs");
const p = await transpile("src/lib/iscottLeadParsing.ts", "needforms-parsing.mjs", [
  'from "./iscottSalesCopy"', 'from "./needforms-sales.mjs"',
]);
const m = await import(pathToFileURL(p).href);

const qualifies = (sentence) => {
  const need = m.extractProjectNeed(sentence);
  return need !== null && m.isSpecificProjectNeed(need);
};

/* ---- MUST QUALIFY. Every one is a real way someone says this out loud. ---- */
for (const sentence of [
  // G's first substantive line in f1163ff3, directly answering iScott's ask.
  "To build brands.",
  // G's own words, ride 2026-08-31 15:20 - the one that lost his phone number.
  "So Scott builds brands and digital websites for people. I'd like to have him build one for me.",
  "I'd like to have him build one for me.",
  "Him to build my brand and website",
  "I'm interested in a website.",
  "I'm looking for someone to redo my back patio.",
  "We're looking for a new brand and a site.",
  "Build me a website and a logo.",
  "Can you build me a site for my landscaping business?",
  "I want a website.",
  "I need a new website for my landscaping business.",
  "I want him to build me a brand.",
  "I, I'm just— does Scott do problem solving? We have some problem areas in my yard that need help.",
  "So, you know, I've got an area that just holds water and the grass is just dead.",
  "Can't get anything to grow there.",
  "Our patio floods every time it rains.",
]) {
  assert.ok(qualifies(sentence), `should qualify: ${sentence}`);
}

/* ---- MUST NOT QUALIFY. The gate behind the extractor still holds. ---- */
for (const sentence of [
  "hello",
  "just looking around",
  "I want to talk to Scott.",              // talking is not a job
  "I need to give you my phone number.",   // contact mechanics
  "I'd like to know more about you.",      // asking, not a job
  "I want to ask a question.",
  "My yard does not hold water.",
  "The email box holds my information.",
  "What should you say about drainage?",
]) {
  assert.equal(qualifies(sentence), false, `must NOT qualify: ${sentence}`);
}

const drainage = [
  "We have some problem areas in my yard that need help.",
  "So, you know, I've got an area that just holds water and the grass is just dead.",
  "Can't get anything to grow there.",
];
assert.match(m.visitorProjectNeedFromRows(drainage).projectNeed ?? "", /holds water|problem areas/);
assert.match(m.visitorProjectDetailsFromRows(drainage).join(" "), /holds water.*grass is.*dead/i);
assert.match(m.visitorProjectDetailsFromRows(drainage).join(" "), /grow there/i);

assert.match(
  m.visitorProjectNeedFromRows([
    "I need a koi pond in the backyard.",
    "Never mind the photo upload.",
  ]).projectNeed ?? "",
  /koi pond/i,
  "cancelling a photo upload must not erase the project",
);
assert.match(
  m.visitorProjectNeedFromRows([
    "I need a website makeover.",
    "Scratch that, I need the retaining wall rebuilt.",
  ]).projectNeed ?? "",
  /retaining wall/i,
  "a same-utterance replacement must replace the earlier project",
);
assert.equal(
  m.visitorProjectNeedFromRows([
    "I need a koi pond in the backyard.",
    "Scratch that. Never mind about the project.",
  ]).projectNeed,
  null,
  "an explicit project retraction must not resurrect the earlier project",
);
assert.equal(
  m.projectNeedWasExplicitlyRetracted([
    "I need a koi pond in the backyard.",
    "Scratch that. Never mind about the project.",
  ]),
  true,
);
assert.equal(
  m.projectNeedWasExplicitlyRetracted([
    "I need a website makeover.",
    "Scratch that, I need the retaining wall rebuilt.",
  ]),
  false,
);
assert.equal(m.isSpecificFeedback("My name is Morgan and my email is visitor@example.com."), false);
assert.equal(m.isSpecificFeedback("No, that's not my email. Let me correct it."), true);

console.log("check-iscott-project-need-forms: OK");
