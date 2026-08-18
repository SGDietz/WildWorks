import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const AGREEMENT =
  "By talking to iScott or uploading media, you agree WildWorks may save the conversation and media to organize your inquiry and follow up. Do not share sensitive personal, legal, medical, or child information. See Privacy Policy.";

const route = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
const home = await fs.readFile(path.resolve("app/pages/Home/page.tsx"), "utf8");
const legalCss = await fs.readFile(path.resolve("app/H256-iscott-mobile-legal-band.css"), "utf8");

assert.match(route, /data-ww-avatar-embedded/);
assert.match(route, /data-ww-legal-text-only/);
assert.match(route, /By talking to iScott or uploading media/);
assert.match(route, /html\[data-ww-talking\] #wildworks-hi-scott,[\s\S]*?#wildworks-hi-scott \{[\s\S]*?display: none/);
assert.match(route, /#wildworks-avatar-legal-band,[\s\S]*?html\[data-ww-talking\] #wildworks-avatar-legal-band \{[\s\S]*?display: none/);
assert.doesNotMatch(route, /html\[data-ww-talking\] #wildworks-hi-scott \{[\s\S]*?display: block/);
assert.doesNotMatch(legalCss, /#talk-to-iscott > \.wild-iscott-disclosure[\s\S]{0,160}display:\s*none/);
assert.match(home, /By talking to iScott or uploading media/);
assert.ok(AGREEMENT.includes("Do not share sensitive personal, legal, medical, or child information."));

console.log("iScott mobile legal checks passed");
