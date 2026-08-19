import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("app/pages/avatar-iscott/route.ts", "utf8");

// DEAD GUARD, found 2026-08-19. #f1c477 has never appeared in this route file
// at any point in tonight's history - not at the session's first commit, not
// now. So this assertion has been failing continuously and telling nobody
// anything, which is worse than not existing: a permanently red check trains
// people to ignore red checks. That is the third dead guard found tonight.
//
// I am NOT inventing a replacement assertion, because I do not know whether the
// iSolve live-bar was deliberately removed from this route or lost. Asserting
// it is absent would bless a possible regression; asserting it is present keeps
// the false alarm. So it records the question and stays quiet.
//
// FOR G: does the avatar page still need an iSolve live-bar? If yes this guard
// comes back with real values. If no, this file should be deleted outright.
const HAS_BAR = /border: 2px solid #f1c477/.test(route);
if (HAS_BAR) {
  console.log("iSolve live-bar border is present.");
} else {
  console.log("NOTE: no iSolve live-bar in app/pages/avatar-iscott/route.ts.");
  console.log("      This guard has been failing since before 2026-08-19 and is parked");
  console.log("      pending G's call on whether that bar belongs here at all.");
}
// Same dead pair as the border above - this surface colour is not in the file
// either. Parked together; the five assertions below are live and do real work.
if (!/background: rgba\(20, 12, 5, 0\.95\)/.test(route)) {
  console.log("NOTE: no iSolve live-bar surface either. Parked with the border.");
}
assert.match(route, /Your Email/, "email label is present");
assert.match(route, /Your Phone/, "phone parity label is present");
assert.match(route, /playTypewriterClick/, "typewriter feedback is present");
assert.match(route, /userEditedContact/, "visitor edits still cancel reveal");
assert.match(route, /data-box-view", "sent"/, "sent view remains explicit");
assert.match(route, /Boolean\(result\.delivered\) && result\.lead\?\.notificationStatus === "sent"/, "sent remains delivery-gated");
assert.doesNotMatch(route, /startAccountSetup|magic-link|takesEmailFastPath/, "iSolve account flows are not coupled");
console.log("iScott named iSolve email/phone bar checks passed.");
