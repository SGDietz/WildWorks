// G 2026-08-19: iScott captured "of@bm.me.so" from G's own ride and mailed the
// lead there, so G never received it. The send was fine; the parser invented an
// address out of the sentence "instead of @bm.me. So it should be".
//
// Every line below is real, from Supabase session
// c8144d30-0bee-4d71-8ffe-2368ee2426f4 (2026-08-19 01:24).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const OUT_DIR = path.resolve(".next/iscott-email-prose");

async function transpileInto(rel, seen = new Set()) {
  const abs = path.resolve(rel);
  const name = path.basename(abs, ".ts");
  if (seen.has(abs)) return path.join(OUT_DIR, `${name}.mjs`);
  seen.add(abs);
  let out = ts.transpileModule(await fs.readFile(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const dep of new Set([...out.matchAll(/from ["'](\.\/[A-Za-z0-9_.-]+)["']/g)].map((m) => m[1]))) {
    await transpileInto(path.join(path.dirname(abs), `${dep.slice(2)}.ts`), seen);
    out = out.split(`from "${dep}"`).join(`from "${dep}.mjs"`).split(`from '${dep}'`).join(`from '${dep}.mjs'`);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, `${name}.mjs`);
  await fs.writeFile(dest, out, "utf8");
  return dest;
}

const { extractEmail, normalizeSpokenEmail } =
  await import(`${pathToFileURL(await transpileInto("src/lib/iscottLeadParsing.ts")).href}?v=${Date.now()}`);

// ---- the exact regression -------------------------------------------------
assert.notEqual(
  extractEmail("instead of @bm.me. So it should be, you know, the system"),
  "of@bm.me.so",
  "THE BUG: a sentence must never be harvested into an address",
);
assert.equal(
  extractEmail("instead of @bm.me. So it should be, you know, the system"),
  null,
  "an address merely being talked about is not a capture",
);

// a preceding word must never become the local part
assert.equal(extractEmail("it was sent to @pm.me by mistake"), null);
assert.equal(extractEmail("talk about @gmail.com generally"), null);

// ---- real captures must still work ---------------------------------------
assert.equal(extractEmail("my email address is sgdietz@pm.me"), "sgdietz@pm.me");
assert.equal(extractEmail("Okay, so my email address is sgdietz@bm.me."), "sgdietz@bm.me");
assert.equal(extractEmail("sgdietz at pm dot me"), "sgdietz@pm.me", "spoken form still captures");
assert.equal(extractEmail("scott at wildworks dot ai"), "scott@wildworks.ai");
assert.equal(
  extractEmail("it's sgdietz@pm.me, not the other one"),
  "sgdietz@pm.me",
  "a real address inside a sentence is still a capture",
);

// ---- the normaliser itself ------------------------------------------------
assert.equal(
  normalizeSpokenEmail("instead of @bm.me. So it should be"),
  "instead of @bm.me. so it should be",
  "literal punctuation keeps its spacing; only spoken at/dot pull text together",
);
assert.equal(normalizeSpokenEmail("sgdietz at pm dot me"), "sgdietz@pm.me");

// ---- the sentence-tail TLD backstop --------------------------------------
assert.equal(extractEmail("reach me at sgdietz@pm.me. So that works"), "sgdietz@pm.me");

console.log("iScott email-from-prose check OK.");
