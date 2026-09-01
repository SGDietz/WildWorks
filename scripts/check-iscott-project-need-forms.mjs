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
]) {
  assert.equal(qualifies(sentence), false, `must NOT qualify: ${sentence}`);
}

console.log("check-iscott-project-need-forms: OK");
