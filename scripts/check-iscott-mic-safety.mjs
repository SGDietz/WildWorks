import assert from "node:assert/strict";
// 2026-08-19: this used to pin the EXACT call text, so adding the acceptNode
// filter that stops the sanitizer eating script bodies failed the guard even
// though the change was the fix. The assertion now checks the walker still
// starts at document.body over text nodes, and leaves the filter free to grow.
import fs from "node:fs/promises";

const route = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");

const shimStart = route.indexOf('<script id="wildworks-avatar-microphone-safety">');
const shimEnd = route.indexOf("const sparkleIcon", shimStart);
assert.ok(shimStart >= 0 && shimEnd > shimStart, "microphone safety shim is installed");
const shim = route.slice(shimStart, shimEnd);

// The remote bundle marks its chunks async, so the shim only helps if it is
// injected ahead of the first remote script rather than late in the head.
assert.match(
  route,
  /\.replace\(\/<script\\b\/i, `\$\{wildWorksMicrophoneSafetyScript\}<script`\)/,
  "shim is injected before the first remote script tag",
);

// Layer 1 must stay EXACTLY the long-proven minimal fallback.  2026-08-17: a
// richer fake media API (enumerateDevices, Navigator.prototype, legacy webkit
// stubs) made the SDK take an untested voice path and crash the whole page
// with a client-side exception on the live preview.  Never expand it again.
assert.match(shim, /Promise\.reject\(new DOMException\(unavailableMessage, "NotAllowedError"\)\)/, "missing getUserMedia rejects with a typed error");
assert.match(shim, /configurable: true,[\s\S]{0,400}writable: true,[\s\S]{0,80}value: \(\) => Promise\.reject/, "CRASH GUARD: the stub is writable -- the remote SDK assigns its own wrapper over it, and a read-only stub throws and kills the app");
assert.match(shim, /if \(!existingMediaDevices \|\| typeof existingMediaDevices\.getUserMedia !== "function"\)/, "a real microphone API is never shimmed over");
assert.doesNotMatch(shim, /enumerateDevices/, "CRASH GUARD: no fake device list -- it sends the SDK down an untested path");
assert.doesNotMatch(shim, /Navigator\.prototype/, "CRASH GUARD: no prototype patching");
assert.doesNotMatch(shim, /webkitGetUserMedia|mozGetUserMedia/, "CRASH GUARD: no legacy callback stubs");

// Layer 2: the rendered-panel cleaner.  React mounts this warning late, as
// nested elements, and re-renders it, so presence alone is not enough.
assert.match(shim, /const unavailableMessage = "Microphone isn't available here\./, "visitor message is plain English");
assert.match(shim, /createTreeWalker\(\s*document\.body,\s*NodeFilter\.SHOW_TEXT/, "cleaner collects the rendered text fragments");
assert.match(shim, /const findWarningPanel = \(nodes\) => \{[\s\S]{0,400}panel\.contains\(other\)/, "the panel is found from the fragments, not from a remote class name");
assert.match(shim, /index === 0 \? cleanWarningText\(current\) : ""/, "nested fragments say the message once instead of repeating it");
assert.match(shim, /rawNode\.data = cleaned/, "cleaner rewrites text in place");
assert.doesNotMatch(shim, /replaceChildren/, "cleaner does not restructure DOM the remote app owns");
assert.doesNotMatch(shim, /dataset\.wildworksMicrophoneWarning/, "no one-shot flag can leave the raw error on screen after a re-render");
assert.match(shim, /if \(cleaned !== current\)/, "cleaner only writes on a real change so the observer cannot loop");
assert.match(shim, /new MutationObserver\(sanitizeRawMicrophoneWarning\)\.observe\(document\.documentElement, \{[\s\S]{0,140}subtree: true,[\s\S]{0,60}characterData: true/, "observer is persistent across late mounts and text-only re-renders");
assert.match(shim, /console\.info\("\[wildworks\] replaced raw microphone warning:"/, "the raw error stays available in the console");

// Behavioural proof, not just presence: run the real cleaning rules against the
// exact string seen on screen.
const messageLine = shim.match(/const unavailableMessage = "[^"]*";/)[0];
const markersBlock = shim.match(/const rawMarkers = \[[\s\S]*?\];/)[0];
const isRawLine = shim.match(/const isRawWarningText = \(text\) => .*;/)[0];
const cleanLine = shim.match(/const cleanWarningText = \(text\) => .*;/)[0];
const cleanWarningText = new Function(
  `${messageLine}\n${markersBlock}\n${isRawLine}\n${cleanLine}\nreturn cleanWarningText;`,
)();

const plainMessage = messageLine.slice(messageLine.indexOf('"') + 1, messageLine.lastIndexOf('"'));
const screenshotText =
  "Microphone not available: Cannot read properties of undefined (reading 'getUserMedia'). Session will continue without voice chat.";

assert.equal(cleanWarningText(screenshotText), plainMessage, "the exact on-screen TypeError becomes one plain sentence");
assert.equal(cleanWarningText(plainMessage), plainMessage, "cleaning is idempotent, so a re-render cannot double it");
assert.doesNotMatch(cleanWarningText(screenshotText), /getUserMedia|undefined|Microphone not available/, "no raw error text can reach a visitor");
assert.equal(
  cleanWarningText("Microphone not available: Permission denied. Session will continue without voice chat."),
  plainMessage,
  "a real permission denial is still one plain sentence",
);
assert.equal(cleanWarningText("Say hello to iScott"), "Say hello to iScott", "unrelated page text is left alone");
assert.equal(
  cleanWarningText("Application error: a client-side exception has occurred"),
  "Application error: a client-side exception has occurred",
  "a non-microphone app error is NOT mislabelled as a mic problem",
);
assert.equal(cleanWarningText(""), "", "empty text nodes are left alone");

// The nested case G reported: fragments in separate elements must resolve to
// one plain sentence with no leftover raw text and no repetition.
const nestedFragments = [
  "Microphone not available: ",
  "Cannot read properties of undefined (reading 'getUserMedia')",
  ". Session will continue without voice chat.",
];
const rendered = nestedFragments
  .map((fragment, index) => (index === 0 ? cleanWarningText(fragment) : ""))
  .join("");
assert.equal(rendered, plainMessage, "a warning split across nested elements reads as one plain sentence");
assert.equal(
  nestedFragments.filter((fragment) => cleanWarningText(fragment) === plainMessage).length,
  nestedFragments.length,
  "every fragment of this warning is recognised, so none is left showing raw text",
);

// Loading field (G 2026-08-17): the avatar's loading background is the site's
// locked red-copper gold-reference formula, never dirt brown.
const siteCopper = "linear-gradient(180deg, #c44d0b 0%, #c44d0b 48%, #c44d0b 100%) #c44d0b !important";
// G 2026-08-19: "that color needs to be changed to one of the main background
// colors." The cover was primary #c44d0b inside a card #e96819 panel, so the
// avatar area read as a hole punched in the card. It now matches the surface
// it covers. Both are brand colours, so this pins WHICH goes WHERE - stricter
// than the old count, which two wrong colours could have satisfied.
const cardCover = "linear-gradient(180deg, #e96819 0%, #e96819 48%, #e96819 100%) #e96819 !important";
assert.equal(route.split(siteCopper).length - 1, 1, "the base field keeps the locked copper formula");
assert.equal(route.split(cardCover).length - 1, 1, "the loading cover matches the card it sits in");
assert.doesNotMatch(route, /#8d5520|#774018/, "dirt-brown loading gradient is gone");

console.log("iScott microphone safety checks passed");
