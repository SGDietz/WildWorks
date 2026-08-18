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
assert.equal(visitorChoseContactMethod("look at this stupid fucking goddamn email box"), null);
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
