import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/iscottLeadCaptureUi.ts");
const source = await fs.readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tempPath = path.resolve(".next/iscott-lead-capture-ui-check.mjs");
await fs.mkdir(path.dirname(tempPath), { recursive: true });
await fs.writeFile(tempPath, output, "utf8");
const {
  listeningCopy,
  methodChoiceFromUtterance,
  nextLeadCaptureUi,
  visitorChoseContactMethod,
} = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);

assert.equal(
  methodChoiceFromUtterance({
    role: "assistant",
    text: "How should Scott reach out to you - email or phone?",
  }),
  null,
  "iScott asking does not open the box",
);
assert.equal(visitorChoseContactMethod("email or phone"), null);
assert.equal(visitorChoseContactMethod("Uh, email's fine."), "email");
assert.equal(visitorChoseContactMethod("phone"), "phone");
assert.equal(visitorChoseContactMethod("as soon as I say email"), null);
// G 2026-08-19: the box must open the moment the visitor COMMITS to a method.
// The old blanket "reach out" guard swallowed these and the box never opened.
assert.equal(
  visitorChoseContactMethod("my name is Kevin and I would like for Scott to reach out by email"),
  "email",
  "visitor answer that echoes the question still commits to email",
);
assert.equal(visitorChoseContactMethod("Scott can reach out by phone"), "phone");
assert.equal(visitorChoseContactMethod("email works for me"), "email");
for (const text of [
  "should be a follow-up email with the information. If, you know, if there's anything like that says, you know, a picture information was saved to this Lead.",
  "I have not received an email.",
  "Did the email with my photo get sent?",
  "You should send Scott a follow-up email.",
]) assert.equal(visitorChoseContactMethod(text), null, "notification talk must not open contact capture: " + text);
assert.equal(visitorChoseContactMethod("Please email me a follow-up email about my photo."), "email");
assert.equal(visitorChoseContactMethod("just call me"), "phone");
// iScott's own question must still never open the box.
assert.equal(visitorChoseContactMethod("How should Scott reach out to you - email or phone?"), null);
assert.equal(visitorChoseContactMethod("Would you like me to reach out by email?"), null);
assert.equal(visitorChoseContactMethod("look at this stupid fucking goddamn email box"), null);
assert.equal(
  visitorChoseContactMethod("Okay, the box, the— your phone. I did— what the fuck? Where did your phone come from?"),
  null,
  "f1163ff3 UI complaint must not flip the capture to phone",
);
assert.equal(visitorChoseContactMethod("Your phone, the words your phone still have a glow on the screen."), null);
assert.equal(visitorChoseContactMethod("Phone. My number is on the screen."), "phone");
assert.equal(visitorChoseContactMethod("I'm throwing my phone against the wall."), null);
// G's desktop ride 1cc18a84, 2026-09-03 15:46 ET: "Um, can I call you Scott?"
// opened the YOUR PHONE box before any contact talk. Calling someone something,
// or asking what to call them, is not asking to be phoned.
assert.equal(visitorChoseContactMethod("Um, can I call you Scott?"), null, "asking what to call iScott is not a phone choice");
assert.equal(visitorChoseContactMethod("What should I call you?"), null);
assert.equal(visitorChoseContactMethod("Call me Scott."), null, "a name introduction is not a phone choice");
assert.equal(visitorChoseContactMethod("Scott can call me."), "phone");
assert.equal(visitorChoseContactMethod("give me a call"), "phone");
assert.equal(visitorChoseContactMethod("call you on the phone"), "phone", "the word phone still wins");
assert.equal(methodChoiceFromUtterance({ role: "user", text: "email's fine" }), "email");

assert.equal(nextLeadCaptureUi({
  speakerRole: "assistant",
  visitorMethod: null,
  hasValidCandidate: false,
}), "hidden");
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "email",
  hasValidCandidate: false,
}), "listening");
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "phone",
  hasValidCandidate: false,
}), "listening");
assert.equal(listeningCopy("email").sendEnabled, false);
assert.equal(listeningCopy("phone").sendEnabled, false);
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "email",
  hasValidCandidate: true,
}), "captured");
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "email",
  hasValidCandidate: true,
  confirmedAction: true,
}), "pending");
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "email",
  hasValidCandidate: true,
  notificationStatus: "sent",
  delivered: true,
}), "sent");
assert.equal(nextLeadCaptureUi({
  speakerRole: "user",
  visitorMethod: "email",
  hasValidCandidate: true,
  notificationStatus: "failed",
}), "failed");

const overlay = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
assert.match(overlay, /data-ui-state", "listening"/);
assert.match(overlay, /data-ui-state"/);
assert.doesNotMatch(
  await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8"),
  /from ["']@?isolve|iSolveUrProblems/,
);
assert.match(
  await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8"),
  /from "\.\/iscottLeadCaptureUi"/,
);

console.log("iScott method-choice UI checks passed");


// visitorChoseContactMethod is implemented TWICE - iscottLeadCaptureUi.ts and
// iscottLeadParsing.ts. Two copies of one rule silently drift, which is how the
// intake rules died last time. Fail the build the moment they stop matching.
import fsSync from "node:fs";
const bodyOf = (file) => {
  const src = fsSync.readFileSync(file, "utf8");
  const start = src.indexOf("export function visitorChoseContactMethod");
  if (start < 0) throw new Error(`visitorChoseContactMethod missing from ${file}`);
  const end = src.indexOf("\n}", start);
  return src.slice(start, end).replace(/\s+/g, " ").trim();
};
assert.equal(
  bodyOf("src/lib/iscottLeadCaptureUi.ts"),
  bodyOf("src/lib/iscottLeadParsing.ts"),
  "the two visitorChoseContactMethod copies have drifted - fix both or merge them",
);

console.log("iScott method-choice check OK.");
