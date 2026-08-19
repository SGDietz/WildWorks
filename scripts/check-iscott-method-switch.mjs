// G's rides, Supabase sessions 6f3a7caa (2026-08-19 03:52) and 89c453ff
// (2026-08-19 12:23). Read item 3 below before changing anything here - the
// second ride REVERSED what the first one taught.
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

// 3. REVERSED 2026-08-19 after ride 89c453ff. This used to assert that a switch
// DROPPED the abandoned method's value. That dropping destroyed one contact per
// switch, and a ride that flips method twice destroyed both - the lead row came
// out with email NULL and phone NULL while the mail to Scott already carried the
// phone. G had asked for both to be kept, in those words, on the same ride.
//
// A captured contact value is never destroyed. Assert the nulling is GONE, so a
// later tidy-up cannot quietly restore it.
assert.doesNotMatch(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,600}if \(methodOnly === "phone"\) email = null;/,
  "a method switch must NOT destroy a captured email",
);
assert.doesNotMatch(
  capture,
  /if \(methodSwitched\) \{[\s\S]{0,600}if \(methodOnly === "email"\) phone = null;/,
  "a method switch must NOT destroy a captured phone",
);

// 3b. Scott must be told EVERY way the visitor left to reach him, not only the
// preferred one. G, ride 89c453ff: "it should say phone and email sent." The
// notification body already lists both; assert it, because item 3 above now
// guarantees both can survive to reach it.
const notify = await readFile("src/lib/voiceEmailNotifications.ts", "utf8");
assert.match(
  notify,
  /email \? `Email: \$\{email\}` : null,[\s\S]{0,40}phone \? `Phone: \$\{phone\}` : null,/,
  "the lead email lists every contact the lead holds, not just the preferred one",
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


// ---------------------------------------------------------------------------
// Grok's Supabase forensics on the same session found three more, 2026-08-19.
// ---------------------------------------------------------------------------

// A second package must be able to go when the CONTACT changes after a send.
// "Already handled" used to mean the whole lead was done; what was actually
// done was one package for one contact, so a later phone number never reached
// Scott at all.
assert.match(
  capture,
  /const sentContact = row\.metadata\?\.last_sent_contact \?\? null;/,
  "the lead records WHICH contact a package was sent to",
);
assert.match(
  capture,
  /const contactAlreadySent = Boolean\(sentContact\) && sentContact === contactHeldNow;/,
  "handled means handled for THIS contact, not for the whole lead",
);
assert.match(
  capture,
  /last_sent_contact: notification\.queued \? sentContactValue/,
  "the sent contact is stamped when the package actually goes",
);

// A lead must never advertise a method it holds no value for. The row that
// started this read contact_method "phone" with phone NULL, which put an
// unanswerable lead in front of Scott.
assert.match(
  capture,
  /if \(contactMethod === "phone" && !phone && email\) contactMethod = "email";/,
  "a method with no value falls back to the one that has a value",
);
assert.match(
  capture,
  /if \(contactMethod === "email" && !email && phone\) contactMethod = "phone";/,
  "and the same in the other direction",
);

console.log("iScott method-switch check OK.");
