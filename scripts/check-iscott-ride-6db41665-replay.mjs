/**
 * Privacy-safe replay of G's 2026-09-02 vertical-iPad ride 6db41665.
 * No network, Supabase, provider, or email call occurs.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import rows from "./fixtures/iscott-6db41665-transcript-snapshot.mjs";

const out = path.resolve(".next", "iscott-6db41665-replay");
await fs.mkdir(out, { recursive: true });
const transpile = async (rel, name, rewrites = []) => {
  let source = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  const target = path.join(out, `${name}.mjs`);
  await fs.writeFile(target, source, "utf8");
  return pathToFileURL(target).href;
};

await transpile("src/lib/iscottSalesCopy.ts", "sales");
const parsingUrl = await transpile("src/lib/iscottLeadParsing.ts", "parsing", [
  ['from "./iscottSalesCopy"', 'from "./sales.mjs"'],
]);
const P = await import(parsingUrl);

const EMAIL = "visitor@example.com";
assert.equal(rows.length, 19, "guard must retain the complete privacy-safe stored snapshot");
const readbackIndex = rows.findIndex((row) => row.message === "You did.");
const permissionIndex = rows.findIndex((row) => row.message === "Um, yes, you may send it to me.");
assert.ok(readbackIndex > 0 && permissionIndex > readbackIndex);
assert.equal(P.detectsContactReadBackCorrect(rows[readbackIndex].message), true);
assert.equal(
  P.evaluateExactContactSendConsent(rows.slice(0, permissionIndex), "email", EMAIL).consented,
  false,
  "read-back and commentary about permission must not count as permission",
);
assert.equal(
  P.evaluateExactContactSendConsent(rows.slice(0, permissionIndex + 2), "email", EMAIL).consented,
  true,
  "the visitor's explicit yes plus To Scott must authorize the completed package",
);

const captureSource = await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8");
const notificationSource = await fs.readFile(path.resolve("src/lib/voiceEmailNotifications.ts"), "utf8");
const avatarSource = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
assert.doesNotMatch(captureSource, /partialSendImmediately/, "read-back must not release recovery mail");
assert.doesNotMatch(notificationSource, /partialSendImmediately/, "no caller can bypass the recovery delay");
assert.match(notificationSource, /deferUntil: isPartial\s*\n?\s*\?/);
assert.match(
  avatarSource,
  /Boolean\(lead\?\.partialNotificationOutboxId\)[\s\S]{0,180}lead\?\.partialNotificationStatus === "sent"[\s\S]{0,180}lead\?\.partialNotificationProviderAccepted === true/,
  "a parked partial must never paint the sent tick",
);

console.log("iScott ride 6db41665 replay OK: no recovery send/tick before permission; explicit consent still sends the full package.");
