// Why this guard exists, and why it now passes on ABSENCE.
//
// G asked four times for a pause: "he should sit there until the people press
// the permission for the microphone, then after they press the permission, two
// seconds, then he starts talking."
//
// It was written twice and never ran. First because waitForMicThenPause was
// declared in one <script> IIFE and awaited from another, so the call threw
// ReferenceError into a silent catch. Then because the microphone-warning
// sanitizer ate the entire script that held it.
//
// When it finally DID run, on ride 99a49da8, it cost TEN SECONDS:
//     mic_waiting        1547ms   state "prompt"
//     mic_wait_timed_out 9549ms   the full 8s cap
//     delay_released    11552ms   then the 2s hold
//     first_video_frame 20158ms   against 4793ms the ride before
//
// It cannot work on that path. The browser does not ask for the microphone
// until the avatar app is starting - which is the call being held - so it waits
// for permission nobody has been asked for, burns the cap, and adds two seconds
// on top. G: "just address the taking really long to load." It was removed.
//
// SO THIS GUARD NOW HAS TWO JOBS:
//   1. If the pause is absent, that is correct - pass, and say why.
//   2. If anyone brings it back, it must be in the SAME <script> block as its
//      call site, or it will silently do nothing exactly as before.
import assert from "node:assert/strict";
import fs from "node:fs";

const FILE = "app/pages/avatar-iscott/route.ts";
const lines = fs.readFileSync(FILE, "utf8").split("\n");

const blocks = [];
let open = null;
lines.forEach((line, i) => {
  const m = line.match(/<script id="([^"]+)"/);
  if (m) open = { id: m[1], from: i };
  else if (open && line.trim() === "</script>") { blocks.push({ ...open, to: i }); open = null; }
});
const blockOf = (needle) => {
  const i = lines.findIndex((l) => l.includes(needle));
  if (i === -1) return null;
  const b = blocks.find((x) => i >= x.from && i <= x.to);
  return { line: i + 1, block: b ? b.id : "OUTSIDE ANY SCRIPT" };
};

const decl = blockOf("const waitForMicThenPause");
const call = blockOf("await waitForMicThenPause()");

if (!decl && !call) {
  console.log("OK - the mic-gated pause is absent, which is the intended state.");
  console.log("     It cost 10s of load on ride 99a49da8 and was removed 2026-08-19.");
  console.log("     If it returns, this guard will require it to live in one script block.");
  process.exit(0);
}

assert.ok(decl, "waitForMicThenPause is CALLED but never declared - it will throw into a silent catch");
assert.ok(call, "waitForMicThenPause is declared but never called - dead code");
console.log(`  declared at ${decl.line} in ${decl.block}`);
console.log(`  called   at ${call.line} in ${call.block}`);
assert.equal(decl.block, call.block,
  "the pause helper and its call site are in DIFFERENT <script> blocks. Each block is its own IIFE, " +
  "so the call throws ReferenceError into a silent catch and the pause never runs - the exact bug " +
  "that hid this feature for weeks.");
console.log("\nOK - helper and call site share one script block.");
