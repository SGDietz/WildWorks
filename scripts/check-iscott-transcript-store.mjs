import assert from "node:assert/strict";
import {
  classifyTranscriptInsertFailure,
  nextSyncBackoffMs,
  sanitizeStoreErrorDetail,
  shouldAdvanceTranscriptCursor,
} from "../src/lib/iscottTranscriptStore.ts";

assert.equal(
  classifyTranscriptInsertFailure(409, "duplicate key value violates unique constraint").treatAsStored,
  true,
);
assert.equal(
  classifyTranscriptInsertFailure(400, "no unique or exclusion constraint matching ON CONFLICT").kind, "on_conflict_mismatch");
assert.equal(classifyTranscriptInsertFailure(500, "connection reset").kind, "store_error");

const sanitized = sanitizeStoreErrorDetail("fail visitor@example.com +1 443-797-2166 ON CONFLICT");
assert.doesNotMatch(sanitized, /visitor@|443/);
assert.match(sanitized, /ON CONFLICT/i);
assert.ok(sanitized.length <= 240);

assert.equal(nextSyncBackoffMs(1), 5000);
assert.equal(nextSyncBackoffMs(2), 10000);
assert.equal(nextSyncBackoffMs(3), 20000);
assert.equal(nextSyncBackoffMs(9), 60000);
assert.equal(shouldAdvanceTranscriptCursor({ httpOk: true, storeFailed: true }), false);
assert.equal(shouldAdvanceTranscriptCursor({ httpOk: false }), false);
assert.equal(shouldAdvanceTranscriptCursor({ httpOk: true, storeFailed: false }), true);

console.log("iScott transcript store checks passed");
