import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

export function phoneShellApplies({ width, height, orientation }) {
  return width <= 520 || (width <= 932 && height <= 560 && orientation === "landscape");
}

assert.equal(phoneShellApplies({ width: 412, height: 915, orientation: "portrait" }), true);
assert.equal(phoneShellApplies({ width: 287, height: 511, orientation: "portrait" }), true);
assert.equal(phoneShellApplies({ width: 430, height: 932, orientation: "portrait" }), true);
assert.equal(phoneShellApplies({ width: 915, height: 412, orientation: "landscape" }), true);
assert.equal(phoneShellApplies({ width: 744, height: 1133, orientation: "portrait" }), false);
assert.equal(phoneShellApplies({ width: 820, height: 1180, orientation: "portrait" }), false);
assert.equal(phoneShellApplies({ width: 1180, height: 820, orientation: "landscape" }), false);
assert.equal(phoneShellApplies({ width: 1366, height: 768, orientation: "landscape" }), false);

const routePath = process.argv[2];
if (routePath) {
  const route = await fs.readFile(path.resolve(routePath), "utf8");
  assert.match(route, /@media \(max-width: 520px\), \(max-width: 932px\) and \(max-height: 560px\) and \(orientation: landscape\)/);
  assert.doesNotMatch(route, /@media \(max-width: 767px\)/);
  assert.doesNotMatch(route, /@media \(max-width: 1024px\), \(max-height: 560px\)/);
  assert.doesNotMatch(route, /transform:\s*scale\(1\.06\)/);
  const phoneBlock = route.slice(route.indexOf("@media (max-width: 520px)"));
  assert.match(phoneBlock, /\.fixed\.bottom-28:has\(\.btn-wood\)[\s\S]{0,180}z-index:\s*30/);
  assert.match(phoneBlock, /z-index:\s*1 !important/);
  assert.match(route, /#wildworks-lead-confirmation \{[\s\S]{0,220}z-index: 40 !important/);
  assert.match(route, /#wildworks-avatar-legal-band \{[\s\S]{0,180}z-index: 2 !important/);
}

console.log("iScott phone geometry checks passed");
