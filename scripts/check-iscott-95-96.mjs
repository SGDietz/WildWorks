import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadTs(rel) {
  const source = await fs.readFile(path.resolve(rel), "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dest = path.resolve(`.next/${path.basename(rel, ".ts")}-9596.mjs`);
  await fs.mkdir(path.resolve(".next"), { recursive: true });
  await fs.writeFile(dest, out, "utf8");
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
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", visitorId: "ww-owner-smoke-1" }), false);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public", operatorQa: true }), false);
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
