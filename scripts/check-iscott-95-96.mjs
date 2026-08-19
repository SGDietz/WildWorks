import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// The transpiled copy has to carry its relative dependencies with it, or the
// module's own imports (./iscottSalesCopy) never resolve and this whole guard
// dies at import time - which is exactly what it had been doing, so none of the
// checks below ever ran. Fixed 2026-08-19.
const OUT_DIR = path.resolve(".next/iscott-9596");

async function transpileInto(rel, seen = new Set()) {
  const abs = path.resolve(rel);
  const name = path.basename(abs, ".ts");
  if (seen.has(abs)) return path.join(OUT_DIR, `${name}.mjs`);
  seen.add(abs);
  const source = await fs.readFile(abs, "utf8");
  let out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps = [...out.matchAll(/from ["'](\.\/[A-Za-z0-9_.-]+)["']/g)].map((m) => m[1]);
  for (const dep of new Set(deps)) {
    await transpileInto(path.join(path.dirname(abs), `${dep.slice(2)}.ts`), seen);
    out = out.split(`from "${dep}"`).join(`from "${dep}.mjs"`).split(`from '${dep}'`).join(`from '${dep}.mjs'`);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, `${name}.mjs`);
  await fs.writeFile(dest, out, "utf8");
  return dest;
}

async function loadTs(rel) {
  const dest = await transpileInto(rel);
  return import(`${pathToFileURL(dest).href}?v=${Date.now()}`);
}

const {
  canDispatchFirstPublicMessageAlert,
  canDispatchIScottLeadNotification,
  resolveTrafficClassification,
} = await loadTs("src/lib/iscottTrafficResolve.ts");
const { sessionLooksLikeOperatorQa } = await loadTs("src/lib/iscottLeadParsing.ts");

assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", sessionId: "codex-76row-retest" }), false);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", visitorId: "ww-test-smoke-1" }), false);
// G 2026-08-19: owner leads now dispatch for real so G gets a true checkmark on
// his own ride. Automated codex-/ww-test- traffic above stays blocked.
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", visitorId: "ww-owner-smoke-1" }), true);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "owner", operatorQa: true }), true);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", operatorQa: true }), false);
// The first-public-message ping stays public-only - G must not be paged about
// talking to his own site.
assert.equal(
  canDispatchFirstPublicMessageAlert({
    classification: { trafficClass: "owner", reason: "owner_test_identifier", confidence: 1 },
  }),
  false,
);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public" }), true);
const unlabeled = resolveTrafficClassification({});
assert.equal(unlabeled.reason, "unlabeled_nonbot");
assert.equal(
  canDispatchFirstPublicMessageAlert({ classification: unlabeled, sessionId: "plain-uuid-session" }),
  false,
);
assert.equal(
  canDispatchFirstPublicMessageAlert({
    classification: { trafficClass: "public", reason: "explicit_identity_label", confidence: 1 },
  }),
  true,
);
assert.equal(sessionLooksLikeOperatorQa(["I need a pool in Atlanta", "Email is fine."]), false);
assert.equal(sessionLooksLikeOperatorQa(["I want to finish my backyard"]), false);
assert.equal(
  sessionLooksLikeOperatorQa(["Okay, when I say email is fine, Boom, the email box, the finish."]),
  true,
);
assert.equal(
  sessionLooksLikeOperatorQa(["So, like, right now, I, I, there's no finish button. I, I can't hit finish."]),
  true,
);
assert.equal(
  sessionLooksLikeOperatorQa(["The code is written for this. It's almost perfect. Just bring that code into here."]),
  true,
);
const capture = await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8");
assert.match(capture, /operatorQa[\s\S]{0,400}canDispatchIScottLeadNotification/);
assert.match(capture, /await notifyIScottLeadByEmail/);
assert.ok(
  capture.indexOf("canDispatchIScottLeadNotification") < capture.indexOf("await notifyIScottLeadByEmail"),
  "notify still after the public-traffic gate",
);
const sync = await fs.readFile(path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"), "utf8");
assert.match(sync, /canDispatchFirstPublicMessageAlert/);
console.log("iScott 95/96 traffic hold check OK.");
