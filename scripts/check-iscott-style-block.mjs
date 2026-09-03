import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/pages/avatar-iscott/route.ts", import.meta.url), "utf8");
const startMarker = "const wildWorksButtonCss = `";
const start = source.indexOf(startMarker);
assert.notEqual(start, -1);
const end = source.indexOf("`;", start + startMarker.length);
assert.notEqual(end, -1);
const template = source.slice(start + startMarker.length, end);
const closers = template.match(/<\/style>/g) ?? [];
assert.equal(closers.length, 1, "avatar style template must contain exactly one literal closer");
assert.equal(template.trimEnd().endsWith("</style>"), true, "avatar style closer must be final");
assert.equal(template.trimEnd().slice(0, -"</style>".length).includes("</style>"), false);

// G's rulings, 2026-09-02, verbatim: "envelope stays on." and "Just a clean little box and then a
// clean confirmation." A build that hides the envelope or the sent tick contradicts him. This runs
// FIRST in `npm run build`, so no installer - human or agent - can ship those hunks.
// RETIRED NEEDLE, Claude 2026-09-02 ~19:5x, G by voice reversing the old
// 'envelope stays on' ruling: "And no envelope. There's an envelope, and then
// when it squeezes down, there's no envelope. Just do no envelope." The
// captured-view envelope ban is gone; H466 hides the icon everywhere.
const banned = [
  'data-box-view="captured"] #wildworks-lead-spoken-readback',
  '[data-box-view="sent"] .wildworks-lead-capture[data-hidden',
  '#wildworks-lead-confirmation .wildworks-lead-card[data-box-view="sent"] #wildworks-lead-sent,',
];
for (const needle of banned) {
  assert.equal(source.includes(needle), false, `G ruled against this: ${needle}`);
}
const flat = source.replace(/\s+/g, " ");
assert.equal(
  flat.includes('.wildworks-lead-card[data-box-view="sent"] #wildworks-lead-sent, .wildworks-lead-card[data-box-view="submitted"] #wildworks-lead-sent { display: flex !important;'),
  true,
  "the sent tick must stay visible in the sent view (G: clean confirmation)",
);
console.log("iScott avatar style-block closer check passed; envelope + sent-tick rulings intact");
