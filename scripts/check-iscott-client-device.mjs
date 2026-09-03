import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/pages/avatar-iscott/route.ts", import.meta.url), "utf8");
const sync = readFileSync(new URL("../app/api/liveavatar/session-transcript/sync/route.ts", import.meta.url), "utf8");
const lead = readFileSync(new URL("../src/lib/iscottLeadCapture.ts", import.meta.url), "utf8");

assert.match(route, /window\.__wildworksClientDevice = \(\) =>/);
for (const marker of ["iscott_media_probe", "avatar_proxy_session_observed", "iscott_start_pace", "iscott_ui_finish_tap"]) {
  const at = route.indexOf(marker);
  assert.notEqual(at, -1, marker + " sender exists");
}
const logEvent = route.slice(route.indexOf("const logEvent ="), route.indexOf("const logUi ="));
const logUi = route.slice(route.indexOf("const logUi ="), route.indexOf("window.__wildworksLogIsScottUi"));
assert.match(logEvent, /device: window\.__wildworksClientDevice\?\.\(\) \|\| \{\}/, "generic app-event sender carries device");
assert.match(logUi, /device: window\.__wildworksClientDevice\?\.\(\) \|\| \{\}/, "generic iScott UI sender carries device");
assert.match(route, /liveAvatarSessionId:[\s\S]{0,500}device: window\.__wildworksClientDevice\?\.\(\) \|\| \{\}/);
assert.match(sync, /function compactClientDevice\(/);
for (const key of ["deviceKind", "os", "browser", "screen", "userAgent"]) assert.match(sync, new RegExp("\\b" + key + "\\b"));
assert.match(sync, /cleanOptionalString\(input\.userAgent, 400\)/);
assert.match(sync, /clientDevice,\s*rows:/);
assert.match(lead, /clientDevice\?: Record<string, string>/);
assert.match(lead, /existing\?\.metadata\?\.client_device/);
assert.match(lead, /client_device: args\.clientDevice/);

const collector = route.slice(route.indexOf("window.__wildworksClientDevice"), route.indexOf("const requestUrl"));
assert.doesNotMatch(collector, /\b(?:email|phone|contact|transcript|token|ipAddress|location)\s*:/i);
console.log("iScott client-device propagation checks passed");
