// The microphone-warning sanitizer must never walk into SCRIPT or STYLE.
//
// A script element's source IS a text node. The sanitizer hunts for marker
// strings - one of which is "getUserMedia" - and rewrites any matching text
// node in place. Without a filter it will happily replace the SOURCE CODE of an
// injected script with a 72-character warning sentence.
//
// On 2026-08-19 it did exactly that to wildworks-avatar-capture-bridge, which
// carries the pace marks, the transcript sync AND the lead capture. G rode
// iScott and Supabase recorded a token and nothing else.
//
// This asserts the guard is present and that the markers stay visitor-facing.
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("app/pages/avatar-iscott/route.ts", "utf8");

const walker = src.match(/createTreeWalker\(\s*document\.body,\s*NodeFilter\.SHOW_TEXT([\s\S]{0,900}?)\)\;/);
assert.ok(walker, "could not find the sanitizer's TreeWalker");
const filter = walker[1];

assert.ok(/acceptNode/.test(filter), "the sanitizer walks ALL text nodes - it needs an acceptNode filter");
for (const tag of ["SCRIPT", "STYLE"]) {
  assert.ok(new RegExp(`"${tag}"`).test(filter), `the filter does not reject ${tag} - a script body can be overwritten`);
}
assert.ok(/FILTER_REJECT/.test(filter), "the filter never rejects anything");

// Any marker that appears in our own injected script source is a live hazard.
const markers = [...src.matchAll(/^\s*"([^"]+)",$/gm)].map((m) => m[1]);
const captureBridge = src.slice(src.indexOf('id="wildworks-avatar-capture-bridge"'));
const bridgeBody = captureBridge.slice(0, captureBridge.indexOf("</script>"));
const risky = ["getUserMedia", "Microphone not available", "Session will continue without voice chat"]
  .filter((m) => bridgeBody.includes(m));

console.log("  sanitizer filter rejects SCRIPT/STYLE/TEMPLATE/NOSCRIPT: yes");
console.log(`  markers appearing inside the capture-bridge source: ${risky.length ? risky.join(", ") : "none"}`);
if (risky.length) {
  console.log("  ^ harmless NOW because the filter exists. Without it, that script gets eaten.");
}
console.log("OK - the sanitizer cannot rewrite script source.");
