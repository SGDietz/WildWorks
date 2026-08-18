import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("app/pages/avatar-iscott/route.ts", "utf8");

assert.match(route, /border: 2px solid #f1c477/, "iSolve live-bar border is present");
assert.match(route, /background: rgba\(20, 12, 5, 0\.95\)/, "iSolve live-bar surface is present");
assert.match(route, /Your Email/, "email label is present");
assert.match(route, /Your Phone/, "phone parity label is present");
assert.match(route, /playTypewriterClick/, "typewriter feedback is present");
assert.match(route, /userEditedContact/, "visitor edits still cancel reveal");
assert.match(route, /data-box-view", "sent"/, "sent view remains explicit");
assert.match(route, /Boolean\(result\.delivered\) && result\.lead\?\.notificationStatus === "sent"/, "sent remains delivery-gated");
assert.doesNotMatch(route, /startAccountSetup|magic-link|takesEmailFastPath/, "iSolve account flows are not coupled");
console.log("iScott named iSolve email/phone bar checks passed.");
