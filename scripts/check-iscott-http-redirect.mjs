import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const middlewarePath = new URL("../middleware.ts", import.meta.url);
const source = await fs.readFile(middlewarePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const nextResponse = {
  next: () => ({ kind: "next" }),
  redirect: (url, status) => ({ kind: "redirect", location: url.href, status }),
};
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module,
  exports: module.exports,
  URL,
  require: (specifier) => {
    assert.equal(specifier, "next/server");
    return { NextResponse: nextResponse };
  },
});

const { middleware } = module.exports;
const request = ({ host, forwardedProto, path = "/pages/Home?ride=1" }) => ({
  headers: new Headers({
    host,
    ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
  }),
  nextUrl: new URL(`http://127.0.0.1:3020${path}`),
});

assert.deepEqual(
  middleware(request({ host: "mission-control.tail00dfe0.ts.net" })),
  {
    kind: "redirect",
    location: "https://mission-control.tail00dfe0.ts.net/pages/Home?ride=1",
    status: 308,
  },
);
assert.deepEqual(
  middleware(request({ host: "100.96.131.75:80", path: "/api/start-session" })),
  {
    kind: "redirect",
    location: "https://mission-control.tail00dfe0.ts.net/api/start-session",
    status: 308,
  },
);
assert.equal(middleware(request({ host: "mission-control.tail00dfe0.ts.net", forwardedProto: "https" })).kind, "next");
assert.equal(middleware(request({ host: "localhost:3020" })).kind, "next");
assert.equal(middleware(request({ host: "wildworks.live", forwardedProto: "https" })).kind, "next");

assert.match(source, /_next\/static\|_next\/image\|favicon\.ico/);
console.log("iScott HTTP-to-HTTPS Tailnet redirect checks passed.");
