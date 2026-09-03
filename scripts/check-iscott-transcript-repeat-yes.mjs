/**
 * G's desktop rides 1cc18a84 (2026-09-03 15:46 ET) and f2815084 (16:30 ET):
 * "Yes." to the read-back, then "Yes." to "May Scott contact you at that phone
 * number about this project?" - and the second one never reached Supabase,
 * because the transcript sync deduped by role + words with no clock. No
 * permission, no send, while the avatar (which heard it) said the send line.
 *
 * The rule now: the same words are a repeat only at the same moment. This
 * drives the helper the sync route uses with the provider timestamps from
 * G's actual ride, and pins the tolerance so a re-stamped line is still one
 * line while a real second answer is kept.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const done = new Map();
async function transpile(rel) {
  const abs = path.resolve(rel);
  if (done.has(abs)) return done.get(abs);
  const target = path.resolve(`.next/repeatyes-${path.basename(abs).replace(/\.ts$/, "")}.mjs`);
  done.set(abs, target);
  const source = await fs.readFile(abs, "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const dep of [...output.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1])) {
    const depTarget = await transpile(path.resolve(path.dirname(abs), dep + (dep.endsWith(".ts") ? "" : ".ts")));
    output = output.split(`from "${dep}"`).join(`from "./${path.basename(depTarget)}"`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
  return target;
}
const parsing = await import(`${pathToFileURL(await transpile("src/lib/iscottLeadParsing.ts")).href}?v=${Date.now()}`);
const { isRepeatedTranscriptMoment, TRANSCRIPT_REPEAT_TOLERANCE_SECONDS } = parsing;

assert.equal(TRANSCRIPT_REPEAT_TOLERANCE_SECONDS, 2, "tolerance is two seconds - wide enough for a re-stamp, far narrower than any real second answer");

// Ride f2815084, provider clock: "Yes." to the read-back at 1788467417, "Yes."
// to the permission question four seconds later. Both must be kept.
const readBackYes = 1788467417;
const permissionYes = readBackYes + 4;
assert.equal(isRepeatedTranscriptMoment([readBackYes], permissionYes), false, "the second Yes four seconds later is a new line");
assert.equal(isRepeatedTranscriptMoment([readBackYes], readBackYes), true, "the same Yes at the same second is the stored one");
assert.equal(isRepeatedTranscriptMoment([readBackYes], readBackYes + 1), true, "a one-second re-stamp is the stored one");
assert.equal(isRepeatedTranscriptMoment([readBackYes], readBackYes + 2), true, "a two-second re-stamp is the stored one");
assert.equal(isRepeatedTranscriptMoment([readBackYes], readBackYes + 3), false, "three seconds apart is a different line");
assert.equal(isRepeatedTranscriptMoment([readBackYes, permissionYes], permissionYes + 40), false, "a third Yes later still counts");
assert.equal(isRepeatedTranscriptMoment(undefined, permissionYes), false, "never-seen words are new");
assert.equal(isRepeatedTranscriptMoment([], permissionYes), false, "never-seen words are new (empty list)");
// Legacy rows without a clock keep the old reading: same words = repeat.
assert.equal(isRepeatedTranscriptMoment([Number.NaN], permissionYes), true, "a stored row with no clock still blocks its words");
assert.equal(isRepeatedTranscriptMoment([readBackYes], Number.NaN), true, "a candidate with no clock cannot be placed and is treated as a repeat");

// The sync route must be using it: source assertions, so a refactor cannot
// quietly return to the words-only key.
const route = await fs.readFile("app/api/liveavatar/session-transcript/sync/route.ts", "utf8");
assert.match(route, /isRepeatedTranscriptMoment\(existingMoments\.get\(key\), originalTimestamp\)/, "the sync route asks the moment helper before dropping a row");
assert.doesNotMatch(route, /if \(existingKeys\.has\(key\)\) return \[\];/, "the words-only drop must not come back");
assert.match(route, /select=role,message,la_absolute_timestamp,metadata&session_id/, "existing rows are read with their metadata so an adjusted stamp still resolves to the original moment");

console.log("iScott transcript repeat-yes checks passed: same words at a new moment are kept; only a same-moment re-stamp is dropped.");
