// Why this guard exists.
//
// G asked for the same thing four rides running: "he should sit there until the
// people press the permission for the microphone, then after they press the
// permission, two seconds, then he starts talking." It was written twice and it
// never once ran.
//
// The reason was not the logic. waitForMicThenPause was declared inside the
// idle-timeout script and awaited inside the capture-bridge script. Both are
// IIFEs, so neither half could see the other, and the call site sits inside a
// try/catch that swallowed the ReferenceError without a sound. The helper also
// reads WILDWORKS_START_DELAY_MS, which lived in the OTHER script again.
//
// The telemetry said it plainly once we looked: start_intercepted fired on every
// ride, delay_released never did, and the intercept-to-return gap matched the
// plain network time of rides with no pause at all.
//
// So this checks the one thing that was actually wrong: the pause helper, the
// constants it reads, and the line that awaits it must all live inside the SAME
// <script> block. Nothing else here can drift and be silent.
import fs from "node:fs";

const FILE = "app/pages/avatar-iscott/route.ts";
const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");

const blocks = [];
let open = null;
lines.forEach((line, i) => {
  const m = line.match(/<script id="([^"]+)"/);
  if (m) open = { id: m[1], from: i };
  else if (open && line.trim() === "</script>") { blocks.push({ ...open, to: i }); open = null; }
});

const blockOf = (needle) => {
  const i = lines.findIndex((l) => l.includes(needle));
  if (i === -1) return { missing: true, needle };
  const b = blocks.find((x) => i >= x.from && i <= x.to);
  return { needle, line: i + 1, block: b ? b.id : "OUTSIDE ANY SCRIPT" };
};

const decl = blockOf("const waitForMicThenPause = async () => {");
const call = blockOf("await waitForMicThenPause();");
const cap = blockOf("const MIC_WAIT_CAP_MS =");
const delay = blockOf("const WILDWORKS_START_DELAY_MS =");
const mark = blockOf('wwPaceMark("delay_released")');

const found = [decl, call, cap, delay, mark];
const missing = found.filter((f) => f.missing);
if (missing.length) {
  console.error("MISSING from route.ts:", missing.map((m) => m.needle).join(", "));
  process.exit(1);
}

const blocksUsed = new Set(found.map((f) => f.block));
for (const f of found) console.log(`  ${String(f.line).padStart(5)}  ${f.block}   ${f.needle.slice(0, 52)}`);

if (blocksUsed.size !== 1) {
  console.error("\nFAIL: the pause is split across " + blocksUsed.size + " script blocks: " + [...blocksUsed].join(", "));
  console.error("Each block is its own IIFE. Split like this, the call throws ReferenceError");
  console.error("into a silent catch and G gets no pause - exactly the bug this guard exists for.");
  process.exit(1);
}
console.log("\nOK - pause helper, its constants and its call site all live in " + [...blocksUsed][0] + ".");
