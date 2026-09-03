// G's ride, Supabase session 89c453ff, 2026-08-19 12:23 UTC.
//
// The lead row came out with email NULL and phone NULL while the mail already
// sent to Scott carried the phone. Two fixes of mine, on two consecutive nights,
// had each destroyed a contact the visitor gave.
//
// Every other check-iscott-* script asserts on SOURCE TEXT. That can only prove
// the shape of the code I wrote, which is the same list the fix was written from,
// which is how a fix confirms itself. This one is different: it drives G's REAL
// TURNS, copied out of the transcript, through the REAL extractors, and asserts
// what those extractors actually decide.
//
// What it proves: the exact turns that destroyed the data still trigger a method
// change (so the bug was real and is reproducible), and those same turns carry no
// contact value (so the credible-turn rule blocks them once a contact is
// confirmed).
//
// What it does NOT prove: the final row. That needs a live ride, and G pays for
// rides. Say so rather than implying more.
//
// Redaction: no full address, no full number. Local part and last four are
// masked in this file; the extractors are fed the masked forms and the assertions
// are on shape, not on G's actual details.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const outDir = path.resolve(".next");
await fs.mkdir(outDir, { recursive: true });

async function transpile(rel, rewrites = []) {
  const name = path.basename(rel).replace(/\.ts$/, "");
  const src = await fs.readFile(path.resolve(rel), "utf8");
  let out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) out = out.replaceAll(from, to);
  const file = path.join(outDir, `replay-${name}.mjs`);
  await fs.writeFile(file, out, "utf8");
  return `./replay-${name}.mjs`;
}

// The capture module reaches Supabase and Resend at runtime. Nothing this check
// touches needs either, so they are stubbed rather than loaded.
const stub = path.join(outDir, "replay-stub.mjs");
await fs.writeFile(
  stub,
  [
    "export const notifyIScottLeadByEmail = async () => null;",
    "export const getSupabaseAdminConfig = () => ({ url: '', serviceRoleKey: '' });",
    "export const isSupabaseAdminConfigured = () => false;",
    "export const queueSupabaseOperationalAlert = () => undefined;",
  ].join("\n"),
  "utf8",
);

// Transpile the whole local chain, rewriting every relative import to its
// transpiled twin. Anything that only does I/O at runtime resolves to the stub.
const LOCAL = [
  // CLAUDE 2026-09-02 (H443): the visitor receipt now renders through the pure email theme.
  "emailTheme",
  "iscottSalesCopy",
  "iscottLeadParsing",
  "iscottLeadCaptureUi",
  "apiRouteSecurity",
  "trafficClassification",
  "iscottTrafficResolve",
  // Pure gate and copy for the disabled visitor receipt: no I/O, so it is
  // loaded for real rather than stubbed.
  "iscottVisitorConfirmation",
  "iscottLeadCapture",
];
const STUBBED = ["voiceEmailNotifications", "supabaseAdmin", "wildworksOperationalAlerts"];
const rewrites = [
  ...LOCAL.map((n) => [`from "./${n}"`, `from "./replay-${n}.mjs"`]),
  ...STUBBED.map((n) => [`from "./${n}"`, 'from "./replay-stub.mjs"']),
];
for (const name of LOCAL) await transpile(`src/lib/${name}.ts`, rewrites);

const url = (name) =>
  "file:///" + path.join(outDir, `replay-${name}.mjs`).split(path.sep).join("/");

const { iscottLeadCaptureTestUtils } = await import(url("iscottLeadCapture"));
const { extractContactMethod, extractPhone } = iscottLeadCaptureTestUtils;
const { extractEmail } = await import(url("iscottLeadParsing"));

// G's real turns, in the order he said them. Masked where they carry his details.
const T = {
  choseEmail: "My name is Scott, and email's great.",
  spelledEmail: "Okay, my email address is sgdietz@REDACTED.me.",
  offeredPhoneAlso:
    "Yeah, let me give you my phone number also, and Scott can reach out with me either way.",
  gavePhone: "My phone number is 443-797-0000.",
  toastSaidPhoneOnly: "And it said, um, it only said phone number sent.",
  shouldSayBoth:
    "It should say phone and email sent, and those There's, um, brand there's you know, oh, phone sent to Scott.",
  noEmailArrived: "Okay, and I have, um, I have not received an email.",
};

// ---------------------------------------------------------------------------
// 1. The bug was real. These two turns still flip the method in opposite
//    directions - which, under the old code, destroyed one value each.
// ---------------------------------------------------------------------------
assert.equal(
  extractContactMethod(T.offeredPhoneAlso),
  "phone",
  'the "phone number also / either way" turn reads as a switch to phone - under the old rule this destroyed the confirmed email',
);
assert.equal(
  extractContactMethod(T.shouldSayBoth),
  "email",
  'the "it should say phone and email sent" turn reads as a switch back to email - under the old rule this destroyed the phone',
);

// ---------------------------------------------------------------------------
// 2. The turns that flipped it are talk ABOUT THE SCREEN. They carry no contact
//    value at all, which is exactly what methodChangeIsCredible tests, so once a
//    contact is confirmed they can no longer restamp the method.
// ---------------------------------------------------------------------------
for (const [label, text] of [
  ["it only said phone number sent", T.toastSaidPhoneOnly],
  ["it should say phone and email sent", T.shouldSayBoth],
  ["I have not received an email", T.noEmailArrived],
]) {
  assert.equal(extractEmail(text), null, `"${label}" carries no email address`);
  assert.equal(extractPhone(text), null, `"${label}" carries no phone number`);
}

// ---------------------------------------------------------------------------
// 3. The credible path is untouched. A turn that really does carry a value still
//    counts, so a genuine change of mind is never blocked.
// ---------------------------------------------------------------------------
assert.ok(extractEmail(T.spelledEmail), "spelling an address out is still a credible turn");
assert.ok(extractPhone(T.gavePhone), "reading a number out is still a credible turn");
assert.equal(
  extractContactMethod(T.choseEmail),
  "email",
  'answering the intake question with "email\'s great" still chooses the method',
);

// ---------------------------------------------------------------------------
// 4. And the rule itself, as the capture loop applies it: before anything is
//    confirmed every turn is credible; after, only turns carrying a value are.
//
//    HONEST LIMIT: `credible` below MIRRORS the rule, it does not import it -
//    `methodChangeIsCredible` is a closure inside the capture loop and is not
//    reachable from here. So this block proves the rule is RIGHT on G's real
//    words; it does not prove the capture loop still contains it. That half is
//    check-iscott-method-switch.mjs, which asserts the source shape. Neither is
//    sufficient alone. If you delete one, this stops being evidence.
// ---------------------------------------------------------------------------
const credible = (text, confirmed) =>
  !confirmed || Boolean(extractEmail(text)) || Boolean(extractPhone(text));

assert.equal(credible(T.choseEmail, false), true, "nothing confirmed yet - a bare choice counts");
assert.equal(credible(T.gavePhone, true), true, "a real number counts even after confirmation");
assert.equal(
  credible(T.shouldSayBoth, true),
  false,
  "screen talk cannot restamp the method once a contact is confirmed",
);
assert.equal(
  credible(T.noEmailArrived, true),
  false,
  "asking where the email went cannot restamp the method",
);

// ---------------------------------------------------------------------------
// 5. project_need. Scott opens the mail to read the job. On this ride he was
//    sent "A website and then I What type is he good with, you know, coming up
//    with original ideas" - two half sentences welded across a transcript break.
//
//    Replaying the ride showed the value was CLEAN for the first five turns and
//    broke on the sixth, which is where G started talking about the screen. That
//    flips sessionLooksLikeOperatorQa, and the QA branch was returning the raw
//    per-turn accumulation while handing the distilled value to
//    operatorServiceScript. The good answer was computed and thrown away.
// ---------------------------------------------------------------------------
const { visitorProjectNeedFromRows } = await import(url("iscottLeadParsing"));

const ride = [
  "Yeah. Um,",
  "Wow. Uh, so Scott, um, can build Can do landscaping and Um, build brands.",
  "Uh, well, I need a website and then I What type is he good with, you know, coming up with original ideas?",
  "Using all of the state-of-the-art cutting-edge AI technologies. Right? That's what Scott can do. Yeah, put Scott in touch with me. Have him reach out. I want to talk to him.",
  "My name is Scott, and email's great.",
  // turn 6 - where it used to break: G talking about the interface
  "Um, yeah, by the way, there was no 2-second delay. Um, there was garbled speech when, um, when, uh, Uh, iScott came on and, um, this, your email, that's really not attractive. It's not brand colors. I mean, Uh, give it another try. It's too way too dark. And it's not over the finish button.",
];

const needEarly = visitorProjectNeedFromRows(ride.slice(0, 5)).projectNeed;
const needAfterScreenTalk = visitorProjectNeedFromRows(ride).projectNeed;

assert.ok(needEarly, "a job is captured from the first five turns");
assert.ok(
  needAfterScreenTalk,
  "the job survives G talking about the screen - this returned the raw mangle before the fix",
);
assert.doesNotMatch(
  needAfterScreenTalk,
  /and then I\b/,
  "project_need is never the raw welded fragment Scott was mailed on this ride",
);
assert.ok(
  needAfterScreenTalk.split(/\s+/).length <= 8,
  `project_need stays a job, not a transcript dump (got ${needAfterScreenTalk.split(/\s+/).length} words)`,
);

console.log(
  "iScott ride 89c453ff replay OK - the destroying turns reproduce, the credible-turn rule blocks them,",
);
console.log(`  and project_need survives screen talk as ${JSON.stringify(needAfterScreenTalk)}.`);
