// WildWorks visual drift detector.
//
// G, 2026-08-19, looking at a logo I had "fixed": "You drifted here. How do we
// find out where everything drifted and undrifted? Undrift it."
//
// Until now the only answer was "Claude remembers", which is exactly how drift
// survives. This records what the site ACTUALLY RENDERS - computed style, not
// source - and tells you what moved.
//
//   node scripts/ww-visual-baseline.mjs snapshot   # record today as the truth
//   node scripts/ww-visual-baseline.mjs diff       # what has moved since?
//
// Baseline lives at visual-baseline.json in the repo root, so it is versioned
// alongside the code and a drift shows up in review.
//
// Requires the site running on :3020 and Chrome installed. Read-only.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ORIGIN = process.env.WW_ORIGIN || "http://localhost:3020";
const BASELINE = path.resolve("visual-baseline.json");

// G's five locked standard viewports.
const VIEWPORTS = [
  [1920, 1080, "desktop"],
  [1366, 768, "laptop"],
  [1180, 820, "ipad-landscape"],
  [820, 1180, "ipad-portrait"],
  [412, 915, "mobile"],
];

const ROUTES = ["/pages/Home", "/pages/Wildfire", "/pages/The-ruins", "/pages/Projects", "/pages/who-is-g"];

// The properties that carry G's taste. Deliberately narrow: layout jitters by a
// subpixel between runs and would bury the real signal in noise.
const PROPS = [
  "color", "webkitTextFillColor", "textShadow", "fontSize", "fontWeight",
  "fontFamily", "backgroundImage", "backgroundColor", "borderColor",
  "borderRadius", "boxShadow", "filter", "opacity", "transform",
];

let port = 9500;

async function withBrowser(width, height, fn) {
  const profile = path.join(os.tmpdir(), `ww-baseline-${process.pid}-${port}`);
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "--hide-scrollbars", "--force-device-scale-factor=1",
    "--no-first-run", "--no-default-browser-check", "--force-color-profile=srgb", "about:blank",
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
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  try { return await fn(send); }
  finally { try { ws.close(); } catch {} proc.kill(); port += 1; }
}

const COLLECT = function (props) {
  const out = {};
  const seen = Object.create(null);
  for (const el of document.querySelectorAll("body *")) {
    if (["STYLE", "SCRIPT", "NOSCRIPT"].includes(el.tagName)) continue;
    let own = "";
    for (const n of el.childNodes) if (n.nodeType === 3) own += " " + n.textContent;
    own = own.replace(/\s+/g, " ").trim();
    // 2026-08-19: this used to require text, or a/button/input. An <svg> has
    // neither, so every icon on the site was invisible to the detector - it
    // reported "nothing moved" for an icon change I had definitely just made.
    // A false negative is worse than a false alarm, because it is trusted.
    const tag = el.tagName.toUpperCase();
    const isVisual = tag === "A" || tag === "BUTTON" || tag === "INPUT" ||
                     tag === "SVG" || tag === "IMG" || tag === "VIDEO" || tag === "PATH";
    if (own.length < 3 && !isVisual) continue;
    const holder = el.closest("section[id],div[id]");
    // A key that survives re-render: where it is, what it is, what it says.
    let key = [holder ? holder.id : "-", tag.toLowerCase(),
               (el.getAttribute && el.getAttribute("class") ? el.getAttribute("class") : "")
                 .trim().split(/\s+/).slice(0, 2).join("."),
               own.slice(0, 28)].join("|");
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > 1) key += "#" + seen[key];
    const c = getComputedStyle(el);
    const rec = {};
    for (const p of props) {
      let v = c[p];
      if (typeof v !== "string") continue;
      if (v === "none" || v === "" || v === "normal") continue;
      rec[p] = v.length > 180 ? v.slice(0, 180) : v;
    }
    out[key] = rec;
  }
  return JSON.stringify(out);
};

async function snapshotAll() {
  const data = {};
  for (const [w, h, vname] of VIEWPORTS) {
    for (const route of ROUTES) {
      await withBrowser(w, h, async (send) => {
        await send("Page.navigate", { url: ORIGIN + route });
        for (let i = 0; i < 80; i++) {
          const r = await send("Runtime.evaluate", {
            expression: "document.readyState === 'complete' && document.fonts.status === 'loaded'",
            returnByValue: true,
          });
          if (r.result.value) break;
          await new Promise((r2) => setTimeout(r2, 250));
        }
        await new Promise((r) => setTimeout(r, 700));
        const res = await send("Runtime.evaluate", {
          expression: "(" + COLLECT.toString() + ")(" + JSON.stringify(PROPS) + ")",
          returnByValue: true,
        });
        data[`${vname}${route}`] = JSON.parse(res.result.value);
      });
      process.stdout.write(".");
    }
  }
  process.stdout.write("\n");
  return data;
}

const mode = process.argv[2];

if (mode === "snapshot") {
  const data = await snapshotAll();
  fs.writeFileSync(BASELINE, JSON.stringify(data, null, 1), "utf8");
  const n = Object.values(data).reduce((a, o) => a + Object.keys(o).length, 0);
  console.log(`baseline written: ${BASELINE}\n${Object.keys(data).length} view/route pairs, ${n} elements recorded.`);
} else if (mode === "diff") {
  if (!fs.existsSync(BASELINE)) {
    console.error("No baseline yet. Run:  node scripts/ww-visual-baseline.mjs snapshot");
    process.exit(2);
  }
  const before = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const after = await snapshotAll();
  let changed = 0, gone = 0, added = 0;
  for (const scope of Object.keys(before)) {
    const a = before[scope], b = after[scope] || {};
    for (const key of Object.keys(a)) {
      if (!(key in b)) { gone++; console.log(`\nMISSING  [${scope}]  ${key}`); continue; }
      const diffs = [];
      for (const p of new Set([...Object.keys(a[key]), ...Object.keys(b[key])])) {
        if (a[key][p] !== b[key][p]) diffs.push(`    ${p}\n      was: ${a[key][p] ?? "(unset)"}\n      now: ${b[key][p] ?? "(unset)"}`);
      }
      if (diffs.length) { changed++; console.log(`\nDRIFT  [${scope}]  ${key}`); console.log(diffs.join("\n")); }
    }
    for (const key of Object.keys(b)) if (!(key in a)) { added++; }
  }
  console.log(`\n${"=".repeat(60)}`);
  console.log(`drifted: ${changed}   missing: ${gone}   new: ${added}`);
  if (changed === 0 && gone === 0) console.log("Nothing moved. The site renders exactly as the baseline.");
  process.exit(changed || gone ? 1 : 0);
} else {
  console.log("usage:\n  node scripts/ww-visual-baseline.mjs snapshot\n  node scripts/ww-visual-baseline.mjs diff");
  process.exit(2);
}
