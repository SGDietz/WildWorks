import assert from "node:assert/strict";

export function revealTickMayWrite({ tickVersion, currentVersion, userEdited, readOnly }) {
  return tickVersion === currentVersion && !userEdited && !readOnly;
}

export function confirmContactValue({ revealing, userEdited, edited, captured }) {
  if (revealing) return null;
  return (userEdited ? edited : captured) || null;
}

assert.equal(revealTickMayWrite({ tickVersion: 1, currentVersion: 1, userEdited: false, readOnly: false }), true);
assert.equal(revealTickMayWrite({ tickVersion: 1, currentVersion: 2, userEdited: false, readOnly: false }), false);
assert.equal(revealTickMayWrite({ tickVersion: 1, currentVersion: 1, userEdited: true, readOnly: false }), false);
assert.equal(revealTickMayWrite({ tickVersion: 1, currentVersion: 1, userEdited: false, readOnly: true }), false);
assert.equal(confirmContactValue({ revealing: true, userEdited: false, edited: "someone@gmail.co", captured: "someone@gmail.com" }), null);
assert.equal(confirmContactValue({ revealing: false, userEdited: false, edited: "someone@gmail.co", captured: "someone@gmail.com" }), "someone@gmail.com");
assert.equal(confirmContactValue({ revealing: false, userEdited: true, edited: "visitor@example.com", captured: "someone@gmail.com" }), "visitor@example.com");

console.log("iScott reveal tick checks passed");
