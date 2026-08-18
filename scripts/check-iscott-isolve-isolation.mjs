import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const files = [
  "src/lib/iscottLeadCapture.ts",
  "src/lib/iscottLeadParsing.ts",
  "src/lib/iscottLeadCaptureUi.ts",
  "src/lib/iscottLaunchReconcile.ts",
  "app/pages/avatar-iscott/route.ts",
  "app/api/iscott/lead/confirm/route.ts",
  "app/H256-iscott-mobile-legal-band.css",
];
for (const rel of files) {
  const text = await fs.readFile(path.resolve(rel), "utf8");
  assert.doesNotMatch(text, /iSolveUrProblems|apps\/demo\/src|LiveAvatarSession/, `${rel} stays WW-only`);
  assert.doesNotMatch(text, /from ["'][^"']*isolve/i, `${rel} has no iSolve import`);
}
console.log("iScott iSolve isolation checks passed");
