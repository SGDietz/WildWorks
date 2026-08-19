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
assert.match(showLead, /type or spell your email/, "email selection has a safe pre-capture path");
assert.match(showLead, /type or say your phone number/, "phone remains a first-class pre-capture path");
assert.match(showLead, /output\.readOnly = false/, "method-only field stays typable");
assert.match(showLead, /output\.disabled = false/, "method-only field is not locked");
assert.match(showLead, /revealCapturedContact\(output, visible\)/, "confirmed capture drives the reveal");
assert.match(showLead, /output\.readOnly = Boolean\(submitted\)/, "submitted values remain immutable");
assert.match(showLead, /userEditedContact = false/, "a newly captured value may reveal from the start");

const confirmStart = route.indexOf("const confirmLead =");
const confirmEnd = route.indexOf("const showLead =", confirmStart);
const confirm = route.slice(confirmStart, confirmEnd);
assert.match(confirm, /fetch\("\/api\/iscott\/lead\/confirm"/, "send stays behind the explicit confirm control");
assert.match(confirm, /I'm sending that to Scott\./, "pre-send status is the authorized sending copy");
// G 2026-08-19: the two outcomes were split apart deliberately. A FAILED send
// must bring the box back so the visitor can retry. A test-held lead clears on
// the same beat as a real send - it is not an error the visitor can act on.
assert.match(confirm, /else if \(failed\) \{[\s\S]{0,300}setCaptureHidden\(false\)/, "a failed send restores the box for retry");
assert.match(confirm, /if \(testHeld\) \{[\s\S]{0,400}setCaptureHidden\(true\)/, "a held lead clears quietly, it is not a visitor-facing error");
assert.match(confirm, /else if \(delivered\) \{[\s\S]{0,400}setSentVisible\(true, method\)/, "checked sent state requires real delivery");
assert.match(route, /Email sent to Scott ✓/, "terminal email label names Scott");
assert.match(route, /Phone sent to Scott ✓/, "terminal phone label names Scott");
assert.doesNotMatch(route, /Confirm the details before Scott gets them/, "L22 hated confirm copy is gone");
assert.match(route, /hasSendPermission/, "L21 Send waits for permission");
assert.match(route, /button\.hidden = Boolean\(submitted\) \|\| !permitted/, "L21 Send stays hidden until permission or a visitor edit");
assert.match(confirm, /if \(revealingContact\) return;/, "a partial reveal cannot submit");
assert.match(confirm, /userEditedContact \? edited : captured/, "visitor-edited email or phone is authoritative");
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
