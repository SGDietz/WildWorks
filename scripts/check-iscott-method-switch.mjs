// G's ride, Supabase session 6f3a7caa, 2026-08-19 03:52.
//
// He gave an email, confirmed it, then changed his mind and asked to be reached
// by PHONE, and read the number out. iScott read it back correctly and said it
// was sent. The lead row was written with contact_method "phone", phone NULL,
// and the OLD email still attached - then submitted and mailed to Scott. A lead
// reached Scott carrying the wrong way to answer it.
//
// The cause was a fix of mine from earlier the same night: making a confirmed
// contact sticky, so prose about an address could not overwrite it. That guard
// also blocked a legitimate change of method, because a phone number does not
// "sound like a correction".
//
// This asserts the shape of the fix in source. It is a source check, not a live
// one - it cannot prove the lead row is right, only that the rule that broke it
// is gone and the reason is recorded.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const capture = await readFile("src/lib/iscottLeadCapture.ts", "utf8");

// 1. A change of method must be recognised at all.
assert.match(
  capture,
  /const methodSwitched = Boolean\(methodOnly\) && methodOnly !== contactMethod;/,
  "a change of contact method is detected",
);

// 2. It must be able to take a value even when a contact is already confirmed.
assert.match(
  capture,
  /if \(!contactAlreadyConfirmed \|\| soundsLikeCorrection \|\| methodSwitched\) \{/,
  "a method switch can still capture its value past a confirmed contact",
);

// 3. The abandoned method's value must not ride along on the new lead.
assert.match(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,400}if \(methodOnly === "phone"\) email = null;/,
  "switching to phone drops the stale email",
);
assert.match(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,400}if \(methodOnly === "email"\) phone = null;/,
  "switching to email drops the stale phone",
);

// 4. A switch must re-open consent - the new value has not been confirmed yet.
assert.match(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,300}contactConfirmedAt = null;/,
  "a method switch clears the old confirmation",
);
assert.match(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,300}consentStatus = "unknown";/,
  "a method switch clears consent so the new value must be confirmed",
);

// 5. The stickiness that caused this must still exist for its real purpose -
//    the fix must not have been "delete the guard".
assert.match(
  capture,
  /const contactAlreadyConfirmed = Boolean\(contactConfirmedAt\);/,
  "a confirmed contact is still protected from being overwritten by prose",
);

console.log("iScott method-switch check OK.");
