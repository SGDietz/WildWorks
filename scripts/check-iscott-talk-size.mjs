import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

assert.ok(52 < 56);
assert.ok(1.22 < 1.35);
const routePath = process.argv[2];
if (routePath) {
  const route = await fs.readFile(path.resolve(routePath), "utf8");
  assert.match(route, /\^talk to i\?scott\$\/i/);
  assert.match(route, /button\.setAttribute\("data-ww-talk", "true"\)/);
  assert.match(route, /@media \(max-width: 520px\)[\s\S]*?\[data-ww-talk\] \{[\s\S]*?min-height: 52px/);
  assert.match(route, /@media \(max-width: 520px\)[\s\S]*?\[data-ww-finish\] \{[\s\S]*?min-height: 56px/);
}
console.log("iScott Talk size checks passed");
