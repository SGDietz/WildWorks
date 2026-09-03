/**
 * One good lead must mail Scott ONCE.
 *
 * G's ride adfdc2ff, 2026-08-31:
 *   14:13:35  "INCOMPLETE iScott lead - Name not provided"
 *   14:14:40  "New iScott lead - Scott"          (same session, 65s later)
 *
 * The incomplete alert fires the moment a contact value appears, which for any
 * conversation that goes on to finish is a minute too early. It is now parked
 * and only becomes mail if no real package follows.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const src = await fs.readFile(path.resolve("src/lib/voiceEmailNotifications.ts"), "utf8");

// 1. The delay exists, and is long enough to outlast a real capture sequence.
const delayMatch = src.match(/const PARTIAL_LEAD_DELAY_MS = ([^;]+);/);
assert.ok(delayMatch, "PARTIAL_LEAD_DELAY_MS must be declared");
const delayMs = Function(`"use strict";return (${delayMatch[1]})`)();
assert.ok(
  delayMs >= 5 * 60 * 1000,
  `the partial delay must outlast a capture sequence; the observed gap was 65s, got ${delayMs}ms`,
);

// 2. Every partial DEFERS. Read-back confirms accuracy, not permission.
assert.match(
  src,
  /deferUntil: isPartial\s*\n?\s*\?\s*new Date\(Date\.now\(\) \+ PARTIAL_LEAD_DELAY_MS\)\.toISOString\(\)\s*\n?\s*:\s*null/,
  "every partial must wait; only the complete consented package may send immediately",
);
assert.doesNotMatch(src, /partialSendImmediately/, "read-back must not release a parked partial");

// 3. deferUntil actually reaches the row, or the delay is decoration.
assert.match(
  src,
  /next_attempt_at: content\.deferUntil \?\? null/,
  "deferUntil must be written to next_attempt_at, which is what the drain selects on",
);

// 4. A deferred row must NOT be sent in the same call.
assert.match(
  src,
  /if \(content\.deferUntil && row\.status === "pending"\)/,
  "a deferred row must short-circuit before delivery is attempted",
);
assert.ok(
  /if \(content\.deferUntil && row\.status === "pending"\)[\s\S]{0,600}?delivered: false/.test(src),
  "the deferred branch must report delivered:false - nothing has been sent yet",
);

// 5. A completed package retires any pending alert for its session.
assert.match(
  src,
  /if \(!isPartial && delivery\.ok\) await supersedePendingPartialLead\(sessionId\)/,
  "a successful complete package must retire the pending partial for that session",
);

// 6. It retires to a status the table actually allows. Read off pg_constraint
//    on 2026-08-31: pending | sending | sent | failed | dead_letter.
const supersede = src.slice(
  src.indexOf("async function supersedePendingPartialLead"),
  src.indexOf("export async function notifyIScottPartialLeadByEmail"),
);
assert.ok(supersede.length > 0, "the supersede helper must exist");
assert.match(supersede, /status: "dead_letter"/, "must retire to an allowed terminal status");
for (const invented of ["cancelled", "canceled", "superseded", "skipped", "void"]) {
  assert.ok(
    !new RegExp(`status: "${invented}"`).test(supersede),
    `"${invented}" is not in the table's CHECK constraint`,
  );
}
assert.match(supersede, /status=eq\.pending/, "only a row that has not gone yet may be retired");
assert.match(supersede, /last_error: "superseded_by_complete_lead"/, "say why, for the audit");

// 7. The tidy-up must never turn a delivered lead into a reported failure.
assert.match(supersede, /catch \{/, "supersede must swallow its own errors");

console.log(
  "iScott partial-lead defer checks passed: incomplete alert parks for " +
    `${Math.round(delayMs / 60000)} minutes and is retired when the real package goes.`,
);
