// The dead-asset-manifest guard. Rewritten 2026-08-19 - the original was handed
// to Chief and never landed in this repo, so every restart since has been judged
// by eye.
//
// FAILURE MODE IT CATCHES: if `next start` is restarted while a build is still
// running, the server keeps the OLD build's asset manifest in memory. The HTML it
// serves then references CSS chunks that no longer exist on disk. The browser
// loads every other stylesheet and SILENTLY DROPS the missing one, so the site
// looks unchanged no matter how many times it is rebuilt.
//
// It cost hours on 2026-08-17 and it bit again today: after one restart, six of
// eighteen stylesheets returned 500 and every measurement lied - the legal Return
// button read 16px with NO rules matching it at all. Rebuilding does not fix it.
// The process has to be replaced:
//     schtasks /End /TN "WildWorks-Site-3020"
//     kill any surviving `next start` node by command line
//     confirm nothing is listening on 3020
//     schtasks /Run /TN "WildWorks-Site-3020"
//
// HABIT: restart -> run this -> only then believe anything you measure, and only
// then tell G to look. A red guard means do not judge the page at all.
//
//   node scripts/check-wildworks-served-assets.mjs [baseUrl]
//   default http://localhost:3020 ; pass the ts.net door to check the public link

const base = (process.argv[2] || "http://localhost:3020").replace(/\/$/, "");
const routes = [
  "/pages/Home", "/pages/Wildfire", "/pages/The-ruins",
  "/pages/Projects", "/pages/who-is-g", "/pages/privacy-policy",
];

let totalBad = 0;
for (const route of routes) {
  let html;
  try {
    const res = await fetch(base + route);
    if (!res.ok) { console.error(`  ${route}  PAGE ${res.status}`); totalBad += 1; continue; }
    html = await res.text();
  } catch (err) {
    console.error(`  ${route}  UNREACHABLE  ${err.message}`);
    totalBad += 1;
    continue;
  }
  const hrefs = [...new Set([...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]))];
  const bad = [];
  await Promise.all(hrefs.map(async (href) => {
    try {
      const r = await fetch(base + href);
      const body = await r.text();
      if (!r.ok || body.length === 0) bad.push(`${href} -> ${r.status}${body.length ? "" : " empty"}`);
    } catch (err) {
      bad.push(`${href} -> ${err.message}`);
    }
  }));
  totalBad += bad.length;
  const mark = bad.length ? "RED " : "ok  ";
  console.log(`  ${mark}${route}  ${hrefs.length} stylesheets, ${bad.length} failed`);
  for (const b of bad) console.log(`         ${b}`);
}

if (totalBad) {
  console.error(`\nGUARD RED - ${totalBad} served asset(s) missing. The server is on a dead manifest.`);
  console.error("Do not judge the page. Replace the process, then run this again.");
  process.exit(1);
}
console.log(`\nGUARD GREEN - every stylesheet the served HTML references answers 200 at ${base}.`);
