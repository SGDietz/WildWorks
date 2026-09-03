import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// 2026-09-03: defaults to the live route so a bare `node` run (the full-suite
// tally) actually checks something instead of printing "passed" for nothing.
const routePath = process.argv[2] || "app/pages/avatar-iscott/route.ts";
if (routePath) {
  const route = await fs.readFile(path.resolve(routePath), "utf8");
  assert.match(route, /\^finish\$\/i/);
  assert.match(route, /button\.setAttribute\("data-ww-finish", "true"\)/);
  // 56px -> 50px (G 2026-09-03 08:56, "take it down 10% on the height") ->
  // 44px (G 2026-09-03 10:07, "make it a good 10 to 15% shorter, just
  // north-south, and that's it").
  assert.match(route, /@media \(max-width: 520px\)[\s\S]*?\[data-ww-finish\] \{[\s\S]*?min-height: 44px/);
  assert.match(route, /void stopSession\("finish"\)/);
  assert.doesNotMatch(route, /\[data-ww-finish\][\s\S]{0,200}display:\s*none/);
}
console.log("iScott Finish size checks passed");
