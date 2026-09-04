import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const securityPath = new URL("../src/lib/apiRouteSecurity.ts", import.meta.url);
const avatarPath = new URL("../app/pages/avatar-iscott/route.ts", import.meta.url);
const startPath = new URL("../app/api/start-session/route.ts", import.meta.url);
const protectedIScottRoutePaths = [
  new URL("../app/api/app-events/log/route.ts", import.meta.url),
  new URL("../app/api/liveavatar/session-transcript/sync/route.ts", import.meta.url),
  new URL("../app/api/v1/sessions/[...path]/route.ts", import.meta.url),
  new URL("../app/api/iscott/lead/confirm/route.ts", import.meta.url),
  new URL("../app/api/media/capture/route.ts", import.meta.url),
];
const telemetryPath = new URL("../src/lib/iscottOriginTelemetry.ts", import.meta.url);

const securitySource = await fs.readFile(securityPath, "utf8");
const avatarSource = await fs.readFile(avatarPath, "utf8");
const startSource = await fs.readFile(startPath, "utf8");
const protectedIScottRouteSources = await Promise.all(
  protectedIScottRoutePaths.map((routePath) => fs.readFile(routePath, "utf8")),
);
const telemetrySource = await fs.readFile(telemetryPath, "utf8");
const compiled = ts.transpileModule(securitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module,
  exports: module.exports,
  Request,
  Response,
  URL,
  process: { env: { NODE_ENV: "production" } },
});

const {
  assertAllowedOrigin,
  WILDWORKS_AVATAR_REQUEST_HEADER,
  WILDWORKS_AVATAR_REQUEST_VALUE,
} = module.exports;
const markerOption = {
  trustedSameOriginMarker: {
    name: WILDWORKS_AVATAR_REQUEST_HEADER,
    value: WILDWORKS_AVATAR_REQUEST_VALUE,
  },
};
const request = (headers = {}) => new Request("https://mission-control.tail00dfe0.ts.net/api/start-session", {
  method: "POST",
  headers,
});

assert.equal(assertAllowedOrigin(request({ origin: "https://mission-control.tail00dfe0.ts.net" }), markerOption), null);
assert.equal(assertAllowedOrigin(request({ origin: "https://evil.example", [WILDWORKS_AVATAR_REQUEST_HEADER]: WILDWORKS_AVATAR_REQUEST_VALUE }), markerOption)?.status, 403);
assert.equal(assertAllowedOrigin(request({ origin: "null", [WILDWORKS_AVATAR_REQUEST_HEADER]: WILDWORKS_AVATAR_REQUEST_VALUE }), markerOption), null);
assert.equal(assertAllowedOrigin(request({ [WILDWORKS_AVATAR_REQUEST_HEADER]: WILDWORKS_AVATAR_REQUEST_VALUE }), markerOption), null);
assert.equal(assertAllowedOrigin(request({ origin: "null" }), markerOption)?.status, 403);
assert.equal(assertAllowedOrigin(request({ [WILDWORKS_AVATAR_REQUEST_HEADER]: "wrong" }), markerOption)?.status, 403);
assert.equal(assertAllowedOrigin(request({ referer: "https://evil.example/page", [WILDWORKS_AVATAR_REQUEST_HEADER]: WILDWORKS_AVATAR_REQUEST_VALUE }), markerOption)?.status, 403);

assert.match(avatarSource, /wildworks-avatar-origin-bridge/);
assert.ok(avatarSource.includes(`const WILDWORKS_AVATAR_REQUEST_HEADER = "${WILDWORKS_AVATAR_REQUEST_HEADER}"`));
assert.ok(avatarSource.includes(`const WILDWORKS_AVATAR_REQUEST_VALUE = "${WILDWORKS_AVATAR_REQUEST_VALUE}"`));
for (const route of [
  "/api/start-session",
  "/api/v1/sessions/start",
  "/api/v1/sessions/stop",
  "/api/app-events/log",
  "/api/liveavatar/session-transcript/sync",
  "/api/iscott/lead/confirm",
  "/api/media/capture",
]) {
  assert.ok(avatarSource.includes(`"${route}"`), `missing browser marker route ${route}`);
}
assert.match(avatarSource, /markerPaths\.has\(url\.pathname\)/);
assert.match(avatarSource, /url\.origin === window\.location\.origin/);
assert.match(avatarSource, /headers\.set\(markerName, markerValue\)/);
assert.match(avatarSource, /tag === "SCRIPT".*tag === "STYLE".*tag === "TEMPLATE".*tag === "NOSCRIPT"/s);
assert.ok(avatarSource.includes('const isRawStartError = /^\\\\s*(?:Forbidden|Too many requests|API request failed)\\\\.?\\\\s*$/i.test'));
assert.match(avatarSource, /Add credits to your LiveAvatar account/);
assert.match(avatarSource, /latestStartFailureClass === "account_credit_exhausted"/);
assert.match(avatarSource, /response\.status === 401 \|\| response\.status === 403 \|\| response\.status === 429/);
assert.match(avatarSource, /wildworks:avatar-start-failed/);
assert.match(startSource, /logIScottOriginRejection/);
assert.match(startSource, /trustedSameOriginMarker/);
assert.ok(startSource.includes(`const WILDWORKS_AVATAR_REQUEST_HEADER = "${WILDWORKS_AVATAR_REQUEST_HEADER}"`));
assert.ok(startSource.includes(`const WILDWORKS_AVATAR_REQUEST_VALUE = "${WILDWORKS_AVATAR_REQUEST_VALUE}"`));
for (const source of protectedIScottRouteSources) {
  assert.match(source, /trustedSameOriginMarker/);
  assert.ok(source.includes(`name: "${WILDWORKS_AVATAR_REQUEST_HEADER}"`));
  assert.ok(source.includes(`value: "${WILDWORKS_AVATAR_REQUEST_VALUE}"`));
  assert.match(source, /logIScottOriginRejection/);
}
assert.match(telemetrySource, /eventType: "liveavatar_origin_rejected"/);
assert.match(telemetrySource, /origin,/);
assert.match(telemetrySource, /host: request\.headers\.get\("host"\)/);
assert.match(telemetrySource, /xForwardedProto: request\.headers\.get\("x-forwarded-proto"\)/);

console.log("iScott Safari origin guard regression checks passed.");
