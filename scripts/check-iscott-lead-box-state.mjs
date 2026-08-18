import assert from "node:assert/strict";

function isSendFailureStatus(status) {
  return status === "failed" || status === "dead_letter";
}

function nextLeadBoxPhase({ phase, visitorHasCandidate, confirmedAction = false, sendInFlight = false, notificationStatus }) {
  if (!visitorHasCandidate) return "hidden";
  if (isSendFailureStatus(notificationStatus) || notificationStatus === "test_held") return "visible";
  if (confirmedAction || sendInFlight || notificationStatus === "queued" || notificationStatus === "sent") {
    return phase === "visible" ? "leaving" : "hidden";
  }
  return "visible";
}

function mayShowSentCheck({ method = "email", notificationStatus, delivered, testHeld = false }) {
  if (testHeld || delivered === false || notificationStatus !== "sent") return { show: false, label: null };
  return { show: true, label: method === "phone" ? "Phone sent to Scott" : "Email sent to Scott" };
}

assert.equal(nextLeadBoxPhase({ phase: "hidden", visitorHasCandidate: false, notificationStatus: null }), "hidden");
assert.equal(nextLeadBoxPhase({ phase: "visible", visitorHasCandidate: true, notificationStatus: null }), "visible");
assert.equal(nextLeadBoxPhase({ phase: "visible", visitorHasCandidate: true, confirmedAction: true, notificationStatus: null }), "leaving");
assert.equal(nextLeadBoxPhase({ phase: "leaving", visitorHasCandidate: true, notificationStatus: "queued" }), "hidden");
assert.equal(nextLeadBoxPhase({ phase: "hidden", visitorHasCandidate: true, notificationStatus: "failed" }), "visible");
assert.equal(nextLeadBoxPhase({ phase: "hidden", visitorHasCandidate: true, notificationStatus: "test_held" }), "visible");
assert.deepEqual(mayShowSentCheck({ notificationStatus: "queued", delivered: true }), { show: false, label: null });
assert.deepEqual(mayShowSentCheck({ notificationStatus: "sent", delivered: false }), { show: false, label: null });
assert.deepEqual(mayShowSentCheck({ notificationStatus: "sent", delivered: true }), { show: true, label: "Email sent to Scott" });
assert.deepEqual(mayShowSentCheck({ method: "phone", notificationStatus: "sent", delivered: true }), { show: true, label: "Phone sent to Scott" });

console.log("iScott lead box transition checks passed");
