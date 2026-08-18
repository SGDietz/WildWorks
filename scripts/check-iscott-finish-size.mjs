import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const routePath = process.argv[2];
if (routePath) {
  const route = await fs.readFile(path.resolve(routePath), "utf8");
  assert.match(route, /\^finish\$\/i/);
  assert.match(route, /button\.setAttribute\("data-ww-finish", "true"\)/);
  assert.match(route, /@media \(max-width: 520px\)[\s\S]*?\[data-ww-finish\] \{[\s\S]*?min-height: 56px/);
  assert.match(route, /void stopSession\("finish"\)/);
  assert.doesNotMatch(route, /\[data-ww-finish\][\s\S]{0,200}display:\s*none/);
}
console.log("iScott Finish size checks passed");
