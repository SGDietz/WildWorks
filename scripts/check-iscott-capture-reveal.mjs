import assert from "node:assert/strict";
import fs from "node:fs/promises";

const route = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");
const revealStart = route.indexOf("const revealCapturedContact =");
const revealEnd = route.indexOf("const refreshLeadPosition", revealStart);
assert.ok(revealStart >= 0 && revealEnd > revealStart, "iSolve-style capture reveal is installed");
const reveal = route.slice(revealStart, revealEnd);

assert.match(reveal, /prefers-reduced-motion/, "reveal respects reduced motion");
assert.match(reveal, /window\.setInterval/, "captured value reveals progressively");
assert.match(reveal, /revealVersion/, "a newer capture cancels an older reveal");
assert.match(reveal, /revealingContact = true/, "Send is guarded while reveal is active");
assert.match(reveal, /button\.disabled = true/, "Send is disabled until reveal completes");
assert.match(reveal, /revealingContact = false/, "reveal completion clears the send guard");
assert.match(reveal, /data-reveal-target/, "a mid-reveal showLead cannot restart the same value");
assert.doesNotMatch(reveal, /fetch\(/, "display reveal cannot send a lead");
assert.match(reveal, /index \+= 1;[\s\S]{0,500}userEditedContact[\s\S]{0,500}output\.value = revealed/, "interval re-checks visitor edit immediately before writing");

const showLeadStart = route.indexOf("const showLead =");
const showLeadEnd = route.indexOf("document\.addEventListener", showLeadStart);
const showLead = route.slice(showLeadStart, showLeadEnd);
assert.match(showLead, /if \(!method\) return;/, "no contact UI before a visitor selects a contact method");
assert.match(showLead, /if \(!value\) \{[\s\S]{0,1800}output\.value = ""[\s\S]{0,1800}button\.hidden = true/, "method-only state never paints or sends a contact");
// G 2026-08-19: "just leave the box open, empty. Don't put in there type or
// spell your." The placeholder is gone on purpose. What this guard was really
// protecting is not - choosing a method must still open an EMPTY, USABLE field
// before anything is captured. That is now asserted directly.
assert.match(showLead, /output\.placeholder = ""/, "pre-capture field opens empty");
assert.match(showLead, /output\.readOnly = false/, "and it is usable, not locked");
assert.doesNotMatch(showLead, /type or spell your email/, "the retired placeholder has not crept back");
// G 2026-08-19: the phone placeholder is retired for the same reason as the
// email one - "just leave the box open, empty."
assert.doesNotMatch(showLead, /type or say your phone number/, "the retired phone placeholder has not crept back");
assert.match(showLead, /output\.readOnly = false/, "method-only field stays typable");
// Shape updated 2026-08-19, intent unchanged. G asked for dashes in the
// displayed phone number ("443-797-2166 ... just visually"), so the confirmed
// captured value now passes through displayContact() on its way to the field.
// It is still the CAPTURED value that drives the reveal - that is what this
// assertion exists to protect - and confirmLead strips the formatting back out
// before anything is sent, so Scott never receives a dashed string.
assert.match(showLead, /output\.disabled = false/, "method-only field is not locked");
assert.match(showLead, /revealCapturedContact\(output, displayContact\(method, visible\)\)/, "confirmed capture drives the reveal");
assert.match(showLead, /output\.readOnly = Boolean\(submitted\)/, "submitted values remain immutable");
assert.match(showLead, /userEditedContact = false/, "a newly captured value may reveal from the start");

const confirmStart = route.indexOf("const confirmLead =");
const confirmEnd = route.indexOf("const showLead =", confirmStart);
const confirm = route.slice(confirmStart, confirmEnd);
assert.match(confirm, /fetch\("\/api\/iscott\/lead\/confirm"/, "send stays behind the explicit confirm control");
// 2026-08-30. The pre-send line used to claim a send had started before the
// server had looked at the package. It says what is actually happening now, and
// says plainly that nothing has gone.
assert.match(
  confirm,
  /status\.textContent = "Checking your details\. Nothing has been sent to Scott yet\.";/,
  "the pre-send status checks details and claims no send",
);
assert.doesNotMatch(
  confirm,
  /status\.textContent = "I'm sending that to Scott\.";/,
  "the optimistic pre-send claim has not crept back",
);
// G 2026-08-19: the two outcomes were split apart deliberately. A FAILED send
// must bring the box back so the visitor can retry.
// Shape updated 2026-08-29, intent unchanged and widened. G's physical ride:
// the API can answer queued:true - which is only the server saying it INTENDS
// to try - while the lead is not submitted and has no submittedAt. Nothing was
// handed off, so that is a failure too, and it takes the same retry path. The
// branch condition is now `failed || !submittedTruth`.
assert.match(confirm, /else if \(failed \|\| !submittedTruth\) \{[\s\S]{0,600}setCaptureHidden\(false\)/, "a failed or unverified send restores the box for retry");
// CORRECTED 2026-08-29. The held branch used to call setCaptureHidden(true)
// outright. A held lead has no submittedAt and the server never marked it
// submitted, so that collapsed the visitor's details on a send that had not
// happened - the same premature collapse the failure path was fixed for. It may
// not hide the capture ahead of verified submitted/submittedAt truth.
assert.match(confirm, /if \(testHeld\) \{[\s\S]{0,1600}setCaptureHidden\(submittedTruth\)/, "a held lead never hides the capture ahead of verified submission");
assert.doesNotMatch(confirm, /if \(testHeld\) \{[\s\S]{0,1600}setCaptureHidden\(true\)/, "no flat capture collapse on a lead that was never submitted");
// FOLLOW-UP 2026-08-29. Keeping the capture and then dropping the panel it
// lives in is the same defect one level up: dropPanelSoon(2000) set `dismissed`
// and hid the whole card two seconds after a send that had not happened, so the
// visitor's value left the screen anyway with no way back to it. Nothing may be
// scheduled to conceal a held lead, and the helper itself is gone so it cannot
// be called back into service.
// (The name survives in the removal note above the helper's old home, so the
//  next reader knows what went and why. What must not survive is a CALL or a
//  redefinition, which is what these two match on.)
assert.doesNotMatch(confirm, /dropPanelSoon\(/, "a held lead may not schedule its own disappearance");
assert.doesNotMatch(route, /const dropPanelSoon = /, "the delayed-hide helper is removed, not merely unused");
assert.doesNotMatch(route, /dropPanelSoon\(\d/, "nothing anywhere may arm a delayed panel hide");
assert.match(
  confirm,
  /if \(testHeld\) \{[\s\S]{0,1800}data-box-view", "captured"\)/,
  "a held lead returns to the captured view rather than staying dimmed and locked in sending",
);
assert.match(
  confirm,
  /if \(testHeld\) \{[\s\S]{0,1800}button\.disabled = false/,
  "and Send comes back, so a held lead stays retryable",
);
// Window widened 2026-08-29 only because the branch carries a longer comment
// now; the assertion itself is unchanged - the tick still requires delivery.
assert.match(confirm, /else if \(delivered\) \{[\s\S]{0,800}setSentVisible\(true, method\)/, "checked sent state requires real delivery");
assert.match(route, /Email sent to Scott ✓/, "terminal email label names Scott");
assert.match(route, /Phone sent to Scott ✓/, "terminal phone label names Scott");
assert.doesNotMatch(route, /Confirm the details before Scott gets them/, "L22 hated confirm copy is gone");
assert.match(route, /hasSendPermission/, "L21 Send waits for permission");
assert.match(
  route,
  /button\.hidden = \(Boolean\(submitted\) && !retryableFailure\) \|\| !permitted \|\| delivered/,
  "L21 Send stays hidden until permission or a visitor edit, except for an intentional failed-send retry",
);
// Shape updated 2026-08-19, intent unchanged: a visitor-typed value still wins
// over the captured one. It is now `editedForSend`, which is the same typed
// value with phone formatting stripped, so a visitor retyping over the dashed
// display cannot put "443-797-2166" into Scott's lead.
assert.match(confirm, /if \(revealingContact\) return;/, "a partial reveal cannot submit");
assert.match(confirm, /userEditedContact \? editedForSend : captured/, "visitor-edited email or phone is authoritative");
assert.match(route, /const cancelRevealForVisitorEdit = \(\) => \{[\s\S]{0,400}revealVersion \+= 1[\s\S]{0,400}revealingContact = false/, "visitor input cancels the reveal immediately");
assert.match(route, /addEventListener\("beforeinput", cancelRevealForVisitorEdit\)/, "visitor input cancels before the edit lands");
assert.match(route, /button\.hidden = !typed && !activeLead\?\.email && !activeLead\?\.phone/, "typed contact unhides Send before capture");
assert.match(route, /#wildworks-avatar-legal-band \{[\s\S]{0,180}z-index: 2 !important/, "legal band stays behind Finish and the card");

assert.match(route, /@media \(max-width: 520px\), \(max-width: 932px\) and \(max-height: 560px\) and \(orientation: landscape\)/, "phone layout is scoped away from iPad mini and iPad portrait");
assert.doesNotMatch(route, /@media \(max-width: 1024px\), \(max-height: 560px\)/, "old broad phone rule is removed");
assert.match(route, /height: 100dvh !important;[\s\S]{0,700}transform: none[\s\S]{0,300}z-index: 1/, "phone talking video fills the frame instead of reserving a legal band");
assert.match(route, /html\[data-ww-talking\] #wildworks-avatar-legal-band/, "talking state hides the in-avatar legal band");
assert.match(route, /data-ww-conversation-control/, "L24 Finish/Talk are named controls");
assert.match(route, /z-index: 45 !important/, "L24/11 conversation controls sit above the legal band");
assert.match(route, /--iscott120-finish-reserve/, "L11/24 card leaves a Finish reserve");
assert.match(route, /lockup\.id = "wildworks-hi-scott"/, "L6 Hi Scott replaces Concierge lockup");
assert.match(route, /data-ww-talking/, "L6 talking state gates Hi Scott");
assert.doesNotMatch(route, /display: none !important;[\s\S]{0,80}data-ww-conversation-control/, "L24 Finish is not display-none");

console.log("iScott capture reveal checks passed");
