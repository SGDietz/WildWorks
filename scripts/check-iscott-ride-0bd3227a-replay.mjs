/**
 * Replay of G's phone ride 0bd3227a (2026-09-03 13:31 ET), the one where he said
 * "Yes." to "May Scott contact you at that email address about this project?",
 * iScott said the send line, and the server refused the send with
 * package_changed_after_permission - the box stayed up, nothing went out.
 *
 * The fault was in mergeLeadTranscriptHistory, not in the ride: the stored
 * snapshot is compacted (fragments joined, filler dropped) and the incoming rows
 * are raw, so raw fragments spoken BEFORE the yes were appended AFTER it, and one
 * of them parsed as a "new" project need. This replays the exact stored snapshot
 * and the exact raw rows through the real code and asserts the send qualifies,
 * that no pre-permission row sits behind the permission, and that a genuinely
 * new row still lands after history. The naive merge is reproduced inline as the
 * negative control so the guard fails loudly if the fault ever comes back.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { lead, stored, live } from "./fixtures/ride-0bd3227a.mjs";

const done = new Map();
async function transpile(rel) {
  const abs = path.resolve(rel);
  if (done.has(abs)) return done.get(abs);
  const target = path.resolve(`.next/ride0bd3227a-${path.basename(abs).replace(/\.ts$/, "")}.mjs`);
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

const proof = parsing.mergeLeadTranscriptHistory(stored, live);
const chronology = parsing.evaluateLeadPackageChronology({
  rows: proof,
  fullName: lead.full_name,
  projectNeed: lead.project_need,
  contactMethod: lead.contact_method,
  contactValue: lead.email,
});
assert.ok(chronology.permissionIndex !== null, "the ride's Yes must still be found as permission");
const permissionAt = proof[chronology.permissionIndex].laAbsoluteTimestamp;
const ghosts = proof
  .slice(chronology.permissionIndex + 1)
  .filter((row) => row.laAbsoluteTimestamp !== null && row.laAbsoluteTimestamp < permissionAt);
assert.deepEqual(
  ghosts,
  [],
  "no row spoken before the permission may sit behind it: " + JSON.stringify(ghosts.map((g) => g.message.slice(0, 40))),
);
assert.deepEqual(chronology.staleFields, [], "nothing changed after the permission on this ride");
const qualification = parsing.evaluateIScottLeadSendQualification({
  fullName: lead.full_name,
  projectNeed: lead.project_need,
  contactMethod: lead.contact_method,
  contactValue: lead.email,
  requestedContactValue: lead.email,
  consentStatus: lead.consent_status,
  contactConfirmedAt: lead.contact_confirmed_at,
  rows: proof,
});
assert.equal(qualification.qualified, true, "ride 0bd3227a must qualify: " + JSON.stringify(qualification.blockers));

// Negative control: the old merge (stored first, then every raw row whose exact
// key is unseen) manufactures the ghost. If this stops failing, the compaction
// changed and the assertions above may be proving nothing.
const naive = (() => {
  const out = [];
  const seen = new Set();
  const push = (role, message, t) => {
    const text = message.trim();
    if (!text) return;
    const key = role + "\0" + (t ?? "none") + "\0" + text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ role, message: text, laAbsoluteTimestamp: t });
  };
  for (const r of stored) push(r.role, r.message, r.timestamp);
  for (const r of live) push(r.role, r.message, r.laAbsoluteTimestamp);
  return out;
})();
const naiveChronology = parsing.evaluateLeadPackageChronology({
  rows: naive,
  fullName: lead.full_name,
  projectNeed: lead.project_need,
  contactMethod: lead.contact_method,
  contactValue: lead.email,
});
assert.ok(naive.length > proof.length, "the naive merge must carry the ghost rows this guard exists for");
assert.ok(
  naiveChronology.staleFields.includes("intent"),
  "the naive merge must reproduce package_changed_after_permission (intent)",
);

// A row that really is new - later than everything stored - still lands after history.
const later = { role: "user", message: "Also my number is 443-797-2166.", laAbsoluteTimestamp: permissionAt + 120 };
const withNew = parsing.mergeLeadTranscriptHistory(stored, [...live, later]);
assert.equal(withNew[withNew.length - 1].message, later.message, "a genuinely new row is appended after history");
assert.equal(withNew.length, proof.length + 1, "exactly one new row is added");
// A repeat of an old line at a NEW time is new too (the last stored row's span is one second).
const repeatYes = { role: "user", message: "Yes.", laAbsoluteTimestamp: permissionAt + 200 };
assert.equal(
  parsing.mergeLeadTranscriptHistory(stored, [...live, repeatYes]).length,
  proof.length + 1,
  "a later identical utterance is not swallowed",
);

console.log(
  `Ride 0bd3227a replay: proof ${proof.length} rows (stored ${stored.length}, raw ${live.length}), permission at index ${chronology.permissionIndex}, qualified, no ghosts behind the yes.`,
);
