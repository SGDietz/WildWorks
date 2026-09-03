import fs from "node:fs";

const source = fs.readFileSync("app/pages/avatar-iscott/route.ts", "utf8");
const failures = [];
const requireTruth = (truth, message) => { if (!truth) failures.push(message); };

const pinStart = source.indexOf("@layer ww-ipad-media-pin");
const pinEnd = source.indexOf("/* ===== H451", pinStart);
const pin = source.slice(pinStart, pinEnd);
requireTruth(pinStart >= 0 && pinEnd >= 0, "measured iPad media-pin authority is missing");
requireTruth(pin.includes("html[data-ww-avatar-embedded][data-ww-embed-measured]"), "media pin is not measured-embed scoped");
requireTruth(!/html\[data-ww-avatar-shell\]/.test(pin), "media pin leaks to non-measured shell");
for (const declaration of [
  "left: 0 !important", "right: auto !important", "margin-left: 0 !important",
  "margin-right: 0 !important", "inset: 0 auto auto 0 !important",
  "width: var(--ww-embed-w) !important", "height: var(--ww-embed-h) !important",
]) requireTruth(pin.includes(declaration), `measured media pin missing material declaration: ${declaration}`);
requireTruth(!pin.includes("margin-left: auto !important"), "rejected 22px centered-container offset remains in pin authority");
requireTruth(!/transform\s*:|scale\s*\(/.test(pin), "measured pin must not add zoom or transform");

const startScreenStart = source.indexOf("physical iPad failed-start screenshot");
const startScreenEnd = source.indexOf("/* G 2026-08-31", startScreenStart);
const startScreen = source.slice(startScreenStart, startScreenEnd);
requireTruth(startScreenStart >= 0 && startScreenEnd >= 0, "measured failed-start screen authority is missing");
requireTruth(startScreen.includes('html[data-ww-avatar-embedded][data-ww-embed-measured]'), "failed-start pin is not measured-embed scoped");
requireTruth(!startScreen.includes("data-ww-finish-returned"), "failed-start still or Talk pin wrongly requires Finish");
for (const token of [
  'img[alt="Start screen"]', ".fixed.bottom-28:has([data-ww-talk])",
  "var(--ww-start-screen-left, 0px)", "var(--ww-fixed-box-w, var(--ww-embed-w))",
  "var(--ww-fixed-box-h, var(--ww-embed-h))", "calc(var(--ww-embed-w) / 2)",
  "margin: 0 !important", "transform: translateX(-50%) !important",
]) requireTruth(startScreen.includes(token), `failed-start alignment missing: ${token}`);
for (const token of [
  "--ww-fixed-box-w", "--ww-fixed-box-h", "--ww-start-screen-left", "fixedBoxWidth * 0.05",
  'fixedProbe.style.setProperty("position", "fixed", "important")',
  'fixedProbe.style.setProperty("inset", "0", "important")',
]) {
  requireTruth(source.includes(token), `failed-start measured variable missing: ${token}`);
}

const emailStatesStart = source.indexOf("@layer ww-email-two-lines-all-states");
const emailStatesEnd = source.indexOf("@layer ww-card-covers-finish", emailStatesStart);
const emailStates = source.slice(emailStatesStart, emailStatesEnd);
requireTruth(emailStatesStart >= 0 && emailStatesEnd >= 0, "all-state email two-line authority is missing");
requireTruth(emailStates.includes('[data-contact-method="email"]'), "two-line cleanup is not email-only");
for (const state of ["captured", "sending", "submitted", "failed", "sent"]) {
  requireTruth(emailStates.includes(`[data-box-view="${state}"]`), `two-line cleanup misses visible email state: ${state}`);
}
for (const child of [
  ".wildworks-lead-label-icon", "#wildworks-lead-spoken-readback", ".wildworks-lead-actions",
  "#wildworks-lead-status", "#wildworks-lead-sent", "#wildworks-lead-sync",
]) requireTruth(emailStates.includes(child), `visible email state still permits extra child: ${child}`);
requireTruth(emailStates.includes("display: none !important"), "email-state extras are not forcibly hidden");
requireTruth(!emailStates.includes('.wildworks-lead-card[data-box-view="sent"] .wildworks-lead-capture[data-hidden="true"]'), "sent state wrongly preserves the capture instead of the clean confirmation");

const geometryStart = source.indexOf('logUi("iscott_embed_geometry"');
const geometryEnd = source.indexOf("geometryLoggedForSession", geometryStart);
const geometry = source.slice(Math.max(0, geometryStart - 1800), geometryEnd);
for (const field of [
  "fixedBoxWidth", "fixedBoxHeight", 'document.querySelectorAll("video, canvas")',
  "objectFit", "objectPosition", "videoIntrinsic", "rect: node.getBoundingClientRect",
]) requireTruth(geometry.includes(field), `iPad geometry telemetry missing: ${field}`);

const finishComment = source.lastIndexOf("Finish has no shadow effect");
const finishEnd = source.indexOf("/* H458", finishComment);
const finish = source.slice(finishComment, finishEnd);
const expectedFinishStops = [
  "0 0.01731em 0 rgba(35, 9, 2, 0.518)",
  "0 0.03461em 0 rgba(33, 8, 2, 0.486)",
  "0 0.05192em 0 rgba(31, 8, 2, 0.455)",
  "0 0.06923em 0 rgba(29, 7, 1, 0.424)",
  "0 0.08654em 0 rgba(27, 7, 1, 0.392)",
  "0 0.10384em 0 rgba(25, 6, 1, 0.36)",
];
requireTruth((finish.match(/rgba\(/g) ?? []).length === 6, "Finish six-stop count changed");
for (const stop of expectedFinishStops) requireTruth(finish.includes(stop), `Finish stop changed: ${stop}`);
requireTruth(finish.includes("-webkit-text-stroke: 0 !important"), "Finish crispness declaration changed");

if (failures.length) {
  for (const failure of failures) console.error(`H458 guard failed: ${failure}`);
  process.exit(1);
}
console.log("H458 measured iPad media pin, Finish preservation, and geometry telemetry guard passed.");
