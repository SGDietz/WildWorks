import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");

const sourceRoot = process.env.WW_EMAIL_THEME_SOURCE_ROOT || ".";
const source = await fs.readFile(path.join(sourceRoot, "src/lib/emailTheme.ts"), "utf8");
const voiceSource = await fs.readFile(path.join(sourceRoot, "src/lib/voiceEmailNotifications.ts"), "utf8");
const out = path.resolve(".next", "owner-email-theme-check.mjs");
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText, "utf8");
const Theme = await import(`${pathToFileURL(out).href}?v=${Date.now()}`);

const palette = {
  pageBg: "#c44d0b",
  cardBg: "#e96819",
  text1: "#fce0ad",
  text2: "#edc775",
  text3: "#f08c28",
};
assert.deepEqual(Theme.THEME, palette, "the five WildWorks email roles stay exact");
const hexes = [...source.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0].toLowerCase());
assert.ok(hexes.length >= 5, "the theme paints the locked palette");
for (const hex of hexes) {
  assert.ok(Object.values(palette).includes(hex), `email theme invented off-palette color ${hex}`);
}

const painted = Theme.emailPaintedCopy("<script>alert(1)</script> Reach a+b@example.com or +1 (443) 555-0142.");
assert.doesNotMatch(painted, /<script>/i, "summary copy is escaped before painting links");
assert.match(painted, /&lt;script&gt;/i, "escaped copy remains visible as text");
assert.match(painted, /href="mailto:a\+b@example\.com"/i, "email is an explicit mailto link");
assert.match(painted, /href="tel:\+14435550142"/i, "phone is an explicit tel link");
assert.match(painted, /color:#fce0ad !important/gi, "auto-linked contact values keep Text 1");

const callout = Theme.emailCallout({ label: "Summary", html: Theme.emailPaintedCopy("Visitor summary") });
const rows = Theme.emailRows([
  ["Name", "Scott"],
  ["Email", "visitor@example.com"],
  ["Session", "b0c50885"],
]);
const button = Theme.emailButton("https://wildworks.example/lead", "Open Lead");
const pre = Theme.emailPre("Line one\nLine two");
const html = Theme.emailShell({
  title: "WildWorks owner email",
  heading: "New Confirmed Lead",
  eyebrow: "WildWorks · iScott",
  bodyHtml: callout + rows + button + pre,
  maxWidth: 760,
});
assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/, "phone viewport is declared");
assert.match(html, /<table role="presentation"/i, "email uses client-safe presentation tables");
assert.match(html, /background:#c44d0b/, "Primary paints the outer page");
assert.match(html, /background:#e96819/, "Secondary paints the card");
assert.doesNotMatch(html, /<style\b|var\(--/i, "email does not rely on stripped style blocks or CSS variables");
assert.doesNotMatch(callout, /background:#c44d0b/i, "summary has no nested Primary brick");
assert.doesNotMatch(pre, /background:#c44d0b/i, "preformatted copy has no nested Primary brick");
assert.match(button, /background:#e96819/i, "button stays on the Secondary card instead of adding a brick");
assert.match(rows, /href="mailto:visitor@example\.com"/i, "row emails defeat client magenta auto-link paint");

for (const eventType of ["iscott_lead", "voice_lead", "voicemail", "telemetry_message", "telemetry_digest"]) {
  assert.match(voiceSource, new RegExp(`eventType:\\s*["']${eventType}["']|event_type:\\s*["']${eventType}["']`), `${eventType} remains represented`);
}
assert.match(voiceSource, /emailPaintedCopy\(summary\)/, "iScott summary contact values use explicit painted links");
assert.match(voiceSource, /label: "Project"/, "structured project facts use the shared flat section");
assert.doesNotMatch(voiceSource, /<img src=.*item\.signedUrl/, "owner email uses secure media links, never embedded images");

console.log("WildWorks owner-email H433 theme guard OK.");
