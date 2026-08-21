/* Guard: the Wildfire page title must be ONE size, and must never be shaved.
 *
 * Two failures this guard exists for, both found 2026-08-19:
 *
 * 1. SIZE DRIFT. <p.wildfire-page-heading> holds two spans that paint every
 *    letter, plus a bare " " text node. H363 shrank the spans to
 *    clamp(2.4rem, 9.5vw, 8.11rem) and left the wrapper at 147.2px. Anyone
 *    measuring the heading ELEMENT read 147.2 and reported a regression;
 *    anyone measuring a SPAN read 129.76 and called it fixed. Both were
 *    looking at the real DOM. Assert they MATCH.
 *
 * 2. SHAVED CAPS. .wild-subpage--wildfire has overflow:hidden, and the heading
 *    has a negative margin-top, so the heading starts above its own clipping
 *    parent. The oversized wrapper used to hide this by accident - its tall
 *    strut pushed the glyphs below the clip line. Fix the size and the caps get
 *    sliced flat on phones. H238 now opens the clip window 40px (margin -40 /
 *    padding +40, which cancel, so nothing moves).
 *
 * Clearance is measured against INK, not box rects. A box rect says where the
 * browser was told to put a line; canvas actualBoundingBoxAscent says where the
 * paint actually starts. The box rect sits above the clip at EVERY viewport and
 * is fine at most of them - only ink tells you which ones shave.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.argv[2] || "http://localhost:3020";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const VIEWPORTS = [
  [1920, 1080, "desktop"], [1366, 768, "laptop"], [1180, 820, "ipad-landscape"],
  [820, 1180, "ipad-portrait"], [412, 915, "mobile"], [287, 511, "narrow"],
];
const MIN_CLEARANCE_PX = 8;

const PROBE = `
  const sub = document.querySelector(".wild-subpage--wildfire");
  const wrap = document.querySelector(".wildfire-page-heading");
  const sp = document.querySelector(".wildfire-page-heading__project");
  if (!sub || !wrap || !sp) return { missing: true };
  const cs = getComputedStyle(sp);
  const rg = document.createRange(); rg.selectNodeContents(sp.firstChild);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
  const m = ctx.measureText(sp.textContent);
  const inkTop = rg.getBoundingClientRect().top + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
  return {
    wrapperFontSize: getComputedStyle(wrap).fontSize,
    spanFontSize: cs.fontSize,
    subOverflow: getComputedStyle(sub).overflow,
    clearance: +(inkTop - sub.getBoundingClientRect().top).toFixed(1),
  };
`;

async function launch(width, height) {
  const port = 9400 + Math.floor(width % 500);
  const profile = path.join(os.tmpdir(), `ww-title-guard-${port}-${process.pid}`);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  const proc = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "--hide-scrollbars", "--force-device-scale-factor=1",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank",
  ], { stdio: "ignore" });
  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
      if (target) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!target) { proc.kill(); throw new Error("chrome did not start"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      await send("Page.navigate", { url });
      for (let i = 0; i < 80; i++) {
        const r = await send("Runtime.evaluate", {
          expression: "document.readyState==='complete' && document.fonts.status==='loaded'",
          returnByValue: true,
        });
        if (r.result.value) break;
        await new Promise((r2) => setTimeout(r2, 250));
      }
      await new Promise((r) => setTimeout(r, 700));
    },
    async probe() {
      const r = await send("Runtime.evaluate", { expression: `(() => { ${PROBE} })()`, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
    close() { try { ws.close(); } catch {} proc.kill(); },
  };
}

const failures = [];
for (const [w, h, name] of VIEWPORTS) {
  const b = await launch(w, h);
  try {
    await b.goto(`${BASE}/pages/Wildfire`);
    const r = await b.probe();
    if (r.missing) { failures.push(`${name}: heading or subpage element not found`); continue; }
    const sizesMatch = r.wrapperFontSize === r.spanFontSize;
    const clears = r.clearance >= MIN_CLEARANCE_PX;
    if (!sizesMatch) failures.push(`${name} ${w}x${h}: wrapper ${r.wrapperFontSize} != span ${r.spanFontSize} (size drift)`);
    if (!clears) failures.push(`${name} ${w}x${h}: ink clearance ${r.clearance}px < ${MIN_CLEARANCE_PX}px (caps shaved by ${r.subOverflow} clip)`);
    console.log(`  ${sizesMatch && clears ? "ok  " : "FAIL"} ${name.padEnd(15)} ${String(w).padStart(4)}x${h}  size ${r.spanFontSize.padEnd(9)} clearance ${String(r.clearance).padStart(6)}px`);
  } finally { b.close(); }
}

console.log("");
if (failures.length) {
  console.error("GUARD RED - Wildfire title:");
  failures.forEach((f) => console.error("  " + f));
  process.exit(1);
}
console.log(`GUARD GREEN - Wildfire title is one size and clears its clip by >=${MIN_CLEARANCE_PX}px at all ${VIEWPORTS.length} viewports (${BASE}).`);
