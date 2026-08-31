// G's physical ride, 2026-08-29. ONE coherent lead-handoff failure, five faces.
//
//   * A red LastPass control sat inside the email field and his own SHORT
//     address ran underneath it - "so longer ones will not stay legible."
//   * iScott read the address back and asked "May I send these details to
//     Scott?" G answered a plain "Yes."
//   * iScott then SPOKE that it was sending and that Scott had the details.
//   * The capture box never changed. No confirmation appeared.
//   * No email arrived.
//
// This file drives the REAL code for all of it. The consent rules are called
// directly out of the TypeScript. The box states are exercised by loading the
// ACTUAL lead-confirmation script out of the route and running it against a
// small DOM, so what is asserted here is what ships, not a paraphrase of it.
//
// Synthetic contacts only. Nothing in this file contacts a person, a provider,
// or a network - fetch is a stub and every assertion is local.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROUTE = path.resolve("app/pages/avatar-iscott/route.ts");
const routeSource = await fs.readFile(ROUTE, "utf8");

// Synthetic fixtures. example.com is reserved by RFC 2606 and can never route.
const EMAIL = "visitor@example.com";
// A long address of the kind real people actually have.
const LONG_EMAIL = "jennifer.mcallister@northlake.example.com";
// And one past what any single line of this width can hold legibly.
const EXTREME_EMAIL = "bartholomew.fitzwilliam-rutherford@northern-lakes-contracting.example.com";
const OTHER_EMAIL = "someone.else@example.com";
const PHONE = "443-555-0142";
const SESSION = "sess-truth-20260829";

/* ------------------------------------------------------------------ *
 * A. CONSENT. The plain "Yes." that G actually said.
 * ------------------------------------------------------------------ */

const out = path.resolve(".next");
await fs.mkdir(out, { recursive: true });
const url = (n) => "file:///" + path.join(out, `lt-${n}.mjs`).split(path.sep).join("/");
async function transpile(rel, rewrites = []) {
  const name = path.basename(rel).replace(/\.ts$/, "");
  let code = ts.transpileModule(await fs.readFile(path.resolve(rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [a, b] of rewrites) code = code.replaceAll(a, b);
  await fs.writeFile(path.join(out, `lt-${name}.mjs`), code, "utf8");
  return `./lt-${name}.mjs`;
}
const salesPath = await transpile("src/lib/iscottSalesCopy.ts");
await transpile("src/lib/iscottLeadParsing.ts", [['from "./iscottSalesCopy"', `from "${salesPath}"`]]);
const P = await import(url("iscottLeadParsing"));

const READBACK = `Let me read that back: ${EMAIL}. Did I get that right?`;
const ASK = "May I send these details to Scott?";

// A1. THE EXACT TRANSCRIPT SEQUENCE. Read-back, send question, plain "Yes."
{
  const consent = P.evaluateContactSendConsent(
    [
      { role: "assistant", message: READBACK, laAbsoluteTimestamp: 40 },
      { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 43 },
      { role: "assistant", message: ASK, laAbsoluteTimestamp: 46 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 48 },
    ],
    "email",
    EMAIL,
  );
  assert.equal(consent.consented, true, "G's exact ride must register as send consent");
  assert.equal(consent.reason, "prompt_then_affirmation");
}

// A2. THE ROOT CAUSE. laAbsoluteTimestamp is nullable the whole way down this
//     pipe. The old rule demanded a clock reading on BOTH turns, so on any turn
//     that arrived without one the plain-yes path was dead code - question
//     recognised, yes recognised, consent still false. That is the failure G
//     rode. Order, not the clock, is what binds the yes to the question.
{
  const consent = P.evaluateContactSendConsent(
    [
      { role: "assistant", message: READBACK, laAbsoluteTimestamp: null },
      { role: "assistant", message: ASK, laAbsoluteTimestamp: null },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: null },
    ],
    "email",
    EMAIL,
  );
  assert.equal(consent.consented, true, "a plain Yes with NO LiveAvatar timestamps must still be consent");
}

// A3. FALSE POSITIVES. A yes that is not an answer to the send question is not
//     permission to mail a stranger's details to Scott.
for (const [label, rows] of [
  ["no send prompt at all", [
    { role: "assistant", message: "Is this for your own home?", laAbsoluteTimestamp: 10 },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: 12 },
  ]],
  ["yes to a different question after the send question", [
    { role: "assistant", message: ASK, laAbsoluteTimestamp: 10 },
    { role: "user", message: "Hang on, what does Scott charge?", laAbsoluteTimestamp: 12 },
    { role: "assistant", message: "He gives a free estimate.", laAbsoluteTimestamp: 14 },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: 16 },
  ]],
  ["a yes long after the question", [
    { role: "assistant", message: ASK, laAbsoluteTimestamp: 10 },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: 10 + 60 * 60 },
  ]],
  ["an outright refusal", [
    { role: "assistant", message: ASK, laAbsoluteTimestamp: 10 },
    { role: "user", message: "No, don't send my info.", laAbsoluteTimestamp: 12 },
  ]],
]) {
  const consent = P.evaluateContactSendConsent(rows, "email", EMAIL);
  assert.equal(consent.consented, false, `${label} must NOT be send consent`);
}

// A4. ADJACENCY has a named reason, so a regression cannot quietly pass by
//     failing for some unrelated cause.
assert.equal(
  P.evaluateContactSendConsent(
    [
      { role: "assistant", message: ASK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Tell me about the warranty.", laAbsoluteTimestamp: 12 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 14 },
    ],
    "email",
    EMAIL,
  ).reason,
  "affirmation_not_adjacent",
);

// A5. CHANGED CONTACT. A yes can never be spent on a value the visitor has
//     since changed - the consent belonged to the address that was read back.
{
  const consent = P.evaluateContactSendConsent(
    [
      { role: "assistant", message: `Let me read that back: ${OTHER_EMAIL}.`, laAbsoluteTimestamp: 10 },
      { role: "assistant", message: ASK, laAbsoluteTimestamp: 12 },
      { role: "user", message: `Actually use ${EMAIL} instead.`, laAbsoluteTimestamp: 14 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 16 },
    ],
    "email",
    OTHER_EMAIL,
  );
  assert.equal(consent.consented, false, "consent must not carry over to a contact the visitor replaced");
}

// A6. And an explicit command is still its own consent, unprompted.
//     ("Send it to Scott." on its own is deliberately NOT accepted - a bare
//     imperative with no affirmation token stays out, and this repair did not
//     widen that.)
for (const command of ["Send my details.", "Yes, send it to Scott."]) {
  assert.equal(
    P.evaluateContactSendConsent(
      [{ role: "user", message: command, laAbsoluteTimestamp: 10 }],
      "email",
      EMAIL,
    ).reason,
    "send_command",
    `"${command}" must stand on its own as a send command`,
  );
}

// A7. The boolean wrapper the pipeline actually calls agrees with all of it.
assert.equal(P.detectsContextualContactSendConfirmation(
  [
    { role: "assistant", message: ASK, laAbsoluteTimestamp: null },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: null },
  ], "email", EMAIL), true);

/* ------------------------------------------------------------------ *
 * B. THE FIELD. LastPass attributes and long-address layout.
 * ------------------------------------------------------------------ */

const inputTag = routeSource.match(/<input id=\\"wildworks-lead-value\\"[^>]*>/)?.[0]
  ?? routeSource.match(/<input id="wildworks-lead-value"[^>]*>/)?.[0];
assert.ok(inputTag, "the lead value input must still be built in the route");

// B1. Every opt-out the major managers actually honour.
for (const attr of [
  'data-lpignore="true"',        // LastPass - the red badge G saw
  'data-1p-ignore="true"',       // 1Password
  'data-bwignore="true"',        // Bitwarden
  'data-protonpass-ignore="true"',
  'data-form-type="other"',
]) {
  assert.ok(inputTag.includes(attr), `the email field must carry ${attr}`);
}

// B2. type MUST stay text. type="email"/"tel" is what puts the field in the
//     credential heuristics in the first place; inputmode steers the keyboard
//     instead, so the visitor still gets the right keys.
assert.ok(/type="text"/.test(inputTag), "the field must stay type=text");
assert.ok(!/type="(?:email|tel|password)"/.test(inputTag), "type must never be email/tel/password");
assert.ok(/inputmode="/.test(inputTag), "the keyboard must be steered with inputmode");

// B3. name= must not read like a credential field. LastPass weighs name/id as
//     well as the opt-outs, so "email" in the name invites the badge back.
const nameAttr = inputTag.match(/name="([^"]*)"/)?.[1] ?? "";
assert.ok(nameAttr, "the field needs a name");
assert.ok(!/e-?mail|user|login|pass/i.test(nameAttr), `name="${nameAttr}" reads like a credential field`);

// B4. Ordinary accessibility is NOT collateral damage. The task allows opting
//     out of password managers, not out of screen readers.
assert.ok(/aria-label="/.test(inputTag), "the field must keep an aria-label");
assert.ok(/aria-labelledby="/.test(inputTag), "the field must keep its visible label association");

// B5. Autofill is opted out on THIS one field only - never disabled site-wide.
assert.ok(/autocomplete="off"/.test(inputTag), "this field opts out of autofill");
const autocompleteOffCount = (routeSource.match(/autocomplete="off"/g) || []).length;
assert.ok(autocompleteOffCount <= 4, "autocomplete=off must stay scoped, not blanket the app");

// B6. LAYOUT. Symmetric horizontal padding wide enough to park a badge over
//     padding instead of over glyphs, on whichever edge the extension picks.
const valueCss = routeSource.match(/#wildworks-lead-value \{[^}]*\}/)?.[0];
assert.ok(valueCss, "the lead value field must still be styled");
const padding = valueCss.match(/padding:\s*([\d.]+)rem\s+([\d.]+)rem/);
assert.ok(padding, "the field must declare vertical/horizontal padding");
const horizontalRem = Number(padding[2]);
assert.ok(horizontalRem >= 1.5, `horizontal padding ${horizontalRem}rem is too narrow to hold a badge`);
assert.ok(/box-sizing:\s*border-box/.test(valueCss), "padding must be inside the box, not added to it");

// B7. The browsers' own in-field controls are opted out too - they sit exactly
//     where the value ends.
for (const pseudo of [
  "::-webkit-credentials-auto-fill-button",
  "::-webkit-contacts-auto-fill-button",
]) {
  assert.ok(routeSource.includes(`#wildworks-lead-value${pseudo}`), `${pseudo} must be suppressed`);
}
// B8. Injected extension roots are hidden by NAME only, scoped to this card, so
//     an unrelated node is never swept up.
assert.ok(routeSource.includes(".wildworks-lead-capture [data-lastpass-icon-root]"));
assert.ok(routeSource.includes(".wildworks-lead-capture [data-lastpass-root]"));

/* ------------------------------------------------------------------ *
 * C. A tiny DOM, just big enough to run the real script.
 * ------------------------------------------------------------------ */

const VOID_TAGS = new Set(["input", "br", "img", "hr", "meta", "link"]);
const CSS_PADDING_PX = horizontalRem * 16;
const FIELD_BORDER_BOX_PX = 304; // 19rem card field, the widest this card gets
// Rough Cambria advance. Only the RATIO matters: it lets the real fit loop
// genuinely overflow and genuinely shrink.
const ADVANCE_RATIO = 0.55;

function parseAttrs(raw) {
  const attrs = {};
  const re = /([:@a-zA-Z_][-:.\w]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attributes = {};
    this.children = [];
    this.parent = null;
    this._text = "";
    this.listeners = {};
    this.onclick = null;
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.value = "";
    this.placeholder = "";
    this.scrollLeft = 0;
    this.style = {
      _props: {},
      setProperty(name, val) { this._props[name] = val; },
      removeProperty(name) { delete this._props[name]; },
      getPropertyValue(name) { return this._props[name] ?? ""; },
    };
    this.classList = {
      _set: new Set(),
      add: (c) => this.classList._set.add(c),
      remove: (c) => this.classList._set.delete(c),
      contains: (c) => this.classList._set.has(c),
    };
  }
  get id() { return this.attributes.id ?? ""; }
  set id(v) { this.attributes.id = v; }
  setAttribute(name, value) { this.attributes[String(name).toLowerCase()] = String(value); }
  getAttribute(name) {
    const v = this.attributes[String(name).toLowerCase()];
    return v === undefined ? null : v;
  }
  removeAttribute(name) { delete this.attributes[String(name).toLowerCase()]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._html ?? ""; }
  set innerHTML(html) {
    this._html = html;
    this.children = [];
    this._text = "";
    const stack = [this];
    const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
      if (m[3] !== undefined) {
        const text = m[3];
        if (text.trim()) stack[stack.length - 1]._text += text.trim();
        continue;
      }
      const tag = m[1].toLowerCase();
      const rest = m[2] ?? "";
      if (m[0].startsWith("</")) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const el = new El(tag);
      const attrs = parseAttrs(rest.replace(/\/\s*$/, ""));
      for (const [k, v] of Object.entries(attrs)) el.attributes[k] = v;
      if ("hidden" in attrs) el.hidden = true;
      stack[stack.length - 1].appendChild(el);
      if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rest)) stack.push(el);
    }
  }
  descendants() {
    const list = [];
    for (const child of this.children) { list.push(child, ...child.descendants()); }
    return list;
  }
  matches(selector) {
    for (const part of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
      const tag = part.match(/^([a-zA-Z][\w-]*)/)?.[1];
      if (tag && this.tagName !== tag.toUpperCase()) continue;
      let ok = true;
      for (const id of part.match(/#[-\w]+/g) || []) {
        if (this.getAttribute("id") !== id.slice(1)) ok = false;
      }
      for (const cls of part.match(/\.[-\w]+/g) || []) {
        const classes = (this.getAttribute("class") || "").split(/\s+/);
        if (!classes.includes(cls.slice(1)) && !this.classList.contains(cls.slice(1))) ok = false;
      }
      for (const attr of part.match(/\[[^\]]+\]/g) || []) {
        const inner = attr.slice(1, -1);
        const eq = inner.match(/^([-\w]+)\s*=\s*"?([^"]*)"?$/);
        if (eq) { if (this.getAttribute(eq[1]) !== eq[2]) ok = false; }
        else if (this.getAttribute(inner) === null) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }
  querySelector(selector) { return this.descendants().find((el) => el.matches(selector)) ?? null; }
  querySelectorAll(selector) { return this.descendants().filter((el) => el.matches(selector)); }
  closest(selector) {
    let node = this;
    while (node) { if (node.matches?.(selector)) return node; node = node.parent; }
    return null;
  }
  getBoundingClientRect() { return { top: 700, bottom: 744, height: 44, left: 0, right: 200, width: 200 }; }
  // The field is a fixed border box; the fit loop shrinks the TEXT inside it.
  get clientWidth() { return FIELD_BORDER_BOX_PX; }
  get scrollWidth() {
    const declared = this.style.getPropertyValue("font-size");
    const rem = declared ? parseFloat(declared) : 1.12;
    return Math.ceil(String(this.value || "").length * rem * 16 * ADVANCE_RATIO);
  }
}

function makeDom() {
  const documentElement = new El("html");
  const body = new El("body");
  documentElement.appendChild(body);
  const timers = [];
  const frames = [];
  let nextId = 1;

  const doc = {
    documentElement,
    body,
    listeners: {},
    createElement: (tag) => new El(tag),
    getElementById: (id) => documentElement.descendants().find((el) => el.getAttribute("id") === id) ?? null,
    querySelector: (sel) => documentElement.querySelector(sel),
    querySelectorAll: (sel) => documentElement.querySelectorAll(sel),
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
  };

  const win = {
    listeners: {},
    innerWidth: 390,
    innerHeight: 844,
    location: { pathname: "/pages/avatar-iscott", origin: "https://wildworks.ai" },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    dispatchEvent(event) { (this.listeners[event.type] || []).forEach((fn) => fn(event)); return true; },
    // prefers-reduced-motion keeps the typewriter reveal out of these tests:
    // the field is filled in one step, which is the accessible path and the
    // deterministic one.
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({
      paddingLeft: `${CSS_PADDING_PX}px`,
      paddingRight: `${CSS_PADDING_PX}px`,
      borderLeftWidth: "1px",
      borderRightWidth: "1px",
    }),
    setTimeout: (fn, ms) => { timers.push({ id: nextId, fn, ms }); return nextId++; },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: (fn, ms) => { timers.push({ id: nextId, fn, ms, interval: true }); return nextId++; },
    clearInterval: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
  };

  return {
    doc,
    win,
    timers,
    frames,
    runTimers() {
      const due = timers.splice(0, timers.length);
      for (const t of due) t.fn();
    },
  };
}

// Pull the REAL script out of the route rather than restating it here.
const scriptBlock = routeSource.match(
  /const wildWorksLeadConfirmationScript = `([\s\S]*?)\n`;/,
);
assert.ok(scriptBlock, "the lead-confirmation script must still be a template literal in the route");
const scriptBody = scriptBlock[1]
  .replace(/^\s*<script id="wildworks-avatar-lead-confirmation">/, "")
  .replace(/<\/script>\s*$/, "");
assert.ok(scriptBody.includes("const confirmLead"), "extracted the wrong block - confirmLead is missing");

function bootScript({ fetchImpl }) {
  const dom = makeDom();
  const sandbox = {
    document: dom.doc,
    window: dom.win,
    localStorage: { getItem: () => "", setItem: () => {} },
    navigator: { sendBeacon: () => true },
    fetch: fetchImpl,
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Date,
    Math,
    JSON,
    Blob: class {},
    console,
  };
  // window.X and bare X have to be the same thing, the way they are in a page.
  for (const key of ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame"]) {
    sandbox[key] = dom.win[key];
  }
  const names = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  new Function(...names, scriptBody)(...names.map((n) => sandbox[n]));
  return dom;
}

const leadState = (over = {}) => ({
  sessionId: SESSION,
  contactMethod: "email",
  email: EMAIL,
  phone: null,
  status: "ready_for_confirmation",
  consentStatus: "accepted",
  contactConfirmedAt: "2026-08-29T15:00:00.000Z",
  submittedAt: null,
  notificationOutboxId: null,
  notificationStatus: null,
  ...over,
});

const jsonResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

// Drive the script the way the page does: dispatch the lead state, then press
// the Send control. Returns the DOM for inspection.
function openCapture(dom, lead) {
  dom.win.dispatchEvent({ type: "wildworks:lead-state", detail: lead });
  return dom;
}
const view = (dom) => dom.doc.querySelector(".wildworks-lead-card")?.getAttribute("data-box-view") ?? null;
const captureHidden = (dom) =>
  dom.doc.querySelector(".wildworks-lead-capture")?.getAttribute("data-hidden") ?? null;
const tick = (dom) => {
  const el = dom.doc.getElementById("wildworks-lead-sent");
  return { visible: el?.getAttribute("data-visible") === "true", text: el?.textContent ?? "" };
};
const statusText = (dom) => dom.doc.getElementById("wildworks-lead-status")?.textContent ?? "";

/* ------------------------------------------------------------------ *
 * D. THE BOX. Pending, success, received-not-delivered, failure.
 * ------------------------------------------------------------------ */

// D1. PENDING. While the confirm request is in flight the box STAYS UP with the
//     value still in it. It used to be hidden here on optimism, before the API
//     had said anything - which is how a failed send left nothing on screen.
{
  let release;
  const inFlight = new Promise((resolve) => { release = resolve; });
  const dom = bootScript({ fetchImpl: (url) => {
    if (String(url).includes("/api/iscott/lead/confirm")) return inFlight;
    return Promise.resolve(jsonResponse({ ok: true }));
  } });
  openCapture(dom, leadState());
  const button = dom.doc.getElementById("wildworks-lead-confirm");
  const pending = button.onclick();

  assert.equal(view(dom), "sending", "the box must show the sending view while in flight");
  assert.equal(captureHidden(dom), "false", "the capture must NOT be hidden before the API replies");
  assert.equal(tick(dom).visible, false, "no confirmation may appear before the API replies");

  release(jsonResponse({
    ok: true, queued: true, delivered: true, detail: "",
    lead: leadState({
      status: "submitted",
      submittedAt: "2026-08-29T15:00:03.000Z",
      notificationOutboxId: "outbox-provider-accepted-pending-test",
      notificationStatus: "sent",
    }),
  }));
  await pending;
}

// D2. SUCCESS. Provider-confirmed delivery: capture replaced by a confirmation
//     that STAYS. G's complaint was a checkmark he could miss by looking away.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: true, detail: "",
    lead: leadState({
      status: "submitted",
      submittedAt: "2026-08-29T15:00:03.000Z",
      notificationOutboxId: "outbox-provider-accepted-success-test",
      notificationStatus: "sent",
    }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(view(dom), "sent");
  assert.equal(captureHidden(dom), "true", "a verified send replaces the capture box");
  assert.equal(tick(dom).visible, true, "a verified send must put a confirmation on screen");
  assert.match(tick(dom).text, /sent to Scott/i);

  // PERSISTENT. Nothing may be queued that takes the confirmation away again.
  dom.runTimers();
  dom.frames.splice(0, dom.frames.length).forEach((fn) => fn());
  dom.runTimers();
  assert.equal(tick(dom).visible, true, "the confirmation must persist, not flash");
  assert.equal(
    dom.doc.getElementById("wildworks-lead-confirmation").classList.contains("wildworks-lead-visible"),
    true,
    "the panel must not drop itself after a verified send",
  );
}

// D3. RECEIVED, NOT SENT. The outbox row exists and the server marked the lead
//     submitted, but the provider has not confirmed delivery. That is a real
//     confirmation and it must NOT borrow the words "sent to Scott".
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "",
    lead: leadState({
      status: "submitted",
      submittedAt: "2026-08-29T15:00:03.000Z",
      notificationOutboxId: "outbox-provider-pending-test",
      notificationStatus: "queued",
    }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(view(dom), "submitted");
  assert.equal(captureHidden(dom), "false", "pending delivery keeps the exact captured value visible");
  assert.equal(tick(dom).visible, true, "a submitted lead must show a confirmation");
  assert.doesNotMatch(tick(dom).text, /sent to Scott/i, "a queued lead must not claim it was sent");
  assert.match(tick(dom).text, /received/i);
}

// D4. THE ONE THAT COST G THE LEAD. The API answers queued:true - which is only
//     the server saying it INTENDS to try - but the lead is not submitted and
//     has no submittedAt. Nothing has been handed off. The box must stay, the
//     visitor must be told plainly, and Send must come back for a retry.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "",
    lead: leadState({ status: "confirmed", submittedAt: null, notificationStatus: "queued" }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(view(dom), "failed", "queued without submitted/submittedAt is a failure, not a success");
  assert.equal(captureHidden(dom), "false", "the capture must stay so the visitor can retry");
  assert.equal(tick(dom).visible, false, "NO success claim without verified submission");
  assert.match(statusText(dom), /Scott does not have this yet/i);
  assert.equal(dom.doc.getElementById("wildworks-lead-confirm").disabled, false, "retry must be available");
}

// D5. A failed outbox row is a failure with the same honest wording.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "voice_email_failed",
    lead: leadState({ status: "submitted", submittedAt: "2026-08-29T15:00:03.000Z", notificationStatus: "failed" }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(view(dom), "failed");
  assert.equal(tick(dom).visible, false, "a failed send may never show a confirmation");
  assert.match(statusText(dom), /Scott does not have this yet/i);
}

// D6. A transport/HTTP failure is the same story - never a silent one.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({ ok: false, error: "server exploded" }, false) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(view(dom), "failed");
  assert.equal(captureHidden(dom), "false");
  assert.equal(tick(dom).visible, false, "no confirmation on a transport failure");
  assert.equal(
    dom.doc.getElementById("wildworks-lead-confirmation").getAttribute("data-handoff-state"),
    "failed",
  );
}

// D7. THE FAILURE MUST SURVIVE THE NEXT POLL. confirmLead repaints, and the
//     poll loop repaints again a moment later. Both used to walk into the
//     "still asking" branch and wipe the failure off the screen.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "",
    lead: leadState({ status: "confirmed", submittedAt: null, notificationStatus: "queued" }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();
  assert.equal(view(dom), "failed");

  // the poll arrives with the same unsubmitted lead
  openCapture(dom, leadState({ status: "confirmed", notificationStatus: "queued" }));
  assert.equal(view(dom), "failed", "a poll must not repaint over a failure");
  assert.match(statusText(dom), /Scott does not have this yet/i);
  assert.equal(tick(dom).visible, false);
}

// D8. A genuinely NEW contact value clears the failure - it is a new capture.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "",
    lead: leadState({ status: "confirmed", submittedAt: null, notificationStatus: "queued" }),
  }) });
  openCapture(dom, leadState());
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();
  assert.equal(view(dom), "failed");

  openCapture(dom, leadState({ email: OTHER_EMAIL, status: "ready_for_confirmation", notificationStatus: null }));
  assert.equal(view(dom), "captured", "a new address is a new capture, not a stuck failure");
}

// D9. TEST-HELD traffic never claims a send either - and, corrected 2026-08-29,
//     it no longer collapses the capture box on the way to saying so. A held
//     lead has no submittedAt and the server never marked it submitted, so
//     taking the visitor's details off the screen there was the same premature
//     collapse the failure path was fixed for.
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({
    ok: true, queued: true, delivered: false, detail: "test_traffic_not_sent",
    lead: leadState({ status: "confirmed", submittedAt: null, notificationStatus: "test_held" }),
  }) });
  openCapture(dom, leadState());
  const field = dom.doc.getElementById("wildworks-lead-value");
  const panel = dom.doc.getElementById("wildworks-lead-confirmation");
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();
  assert.equal(tick(dom).visible, false, "a held test lead must never show a sent confirmation");
  assert.match(statusText(dom), /not sent/i);
  assert.equal(captureHidden(dom), "false",
    "a lead the server never marked submitted may not have its capture taken away");

  // D9b. FOLLOW-UP 2026-08-29. Keeping the capture and then dropping the PANEL
  //      it lives in is the same defect one level up. The held branch used to
  //      call dropPanelSoon(2000), which armed two painted frames, then a 2s
  //      timer, then a hidden-tab backstop - all of which set `dismissed` and
  //      hid the card. Two seconds after a send that had not happened, G's own
  //      value was off the screen with nothing to retry from.
  //
  //      So: run the clock. Frames, then timers, then the frames those timers
  //      queued, then timers again - generously past any 2s + 1.5s backstop.
  //      Nothing may conceal a held lead.
  //
  //      The page also has a 400ms auto-send armed from the moment a consented
  //      lead opened, and draining the clock fires it. That is deliberate: it
  //      makes this the harder case - the held branch runs a SECOND time, from
  //      the automatic path rather than the button - and the settled state has
  //      to be the same afterwards. Each beat is awaited so that attempt's own
  //      promise chain finishes before the next beat runs.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  for (let beat = 0; beat < 4; beat += 1) {
    dom.frames.splice(0, dom.frames.length).forEach((fn) => fn());
    dom.runTimers();
    await settle();
  }

  assert.equal(
    panel.classList.contains("wildworks-lead-visible"),
    true,
    "the panel must still be on screen after the old 2s drop would have fired",
  );
  assert.equal(captureHidden(dom), "false", "and the capture box with it");
  assert.equal(field.value, EMAIL, "the visitor's own value is still in the field");
  assert.equal(tick(dom).visible, false, "no success tick ever appears on a held lead");
  assert.match(statusText(dom), /not sent/i, "the honest wording survives the clock");

  // Retryable and editable: not locked behind the dimmed "sending" view, not
  // read-only, and Send is live so the visitor can try again without retyping.
  assert.notEqual(view(dom), "sending", "a held lead may not sit dimmed and locked in the sending view");
  assert.equal(view(dom), "captured", "it returns to the captured view");
  assert.equal(field.readOnly, false, "the field stays editable");
  assert.equal(field.disabled, false, "and usable");
  assert.equal(dom.doc.getElementById("wildworks-lead-confirm").disabled, false, "Send stays available for a retry");
  assert.equal(dom.doc.getElementById("wildworks-lead-confirm").hidden, false, "and it is on screen to be pressed");
}

//     (What DOES earn the collapse is verified submitted/submittedAt truth, and
//     D2 and D3 above are the two ways that arrives.)

// D10. A BLOCKED LEAD - the 409. The conversation has not finished a step, so
//      the server refuses and says which one. Nothing was sent, the capture box
//      and the value STAY on screen, and Send is live so the visitor can finish
//      the step and try again without retyping anything.
for (const blocked of [
  "Nothing has been sent. iScott still needs your name — say it, then choose Send to Scott again.",
  "Nothing has been sent. iScott has not read that back to you and heard you confirm it yet — ask iScott to read it back, say yes, then choose Send to Scott.",
]) {
  const dom = bootScript({ fetchImpl: async () => ({
    ok: false,
    status: 409,
    json: async () => ({ ok: false, error: blocked }),
  }) });
  openCapture(dom, leadState());
  const field = dom.doc.getElementById("wildworks-lead-value");
  await dom.doc.getElementById("wildworks-lead-confirm").onclick();

  assert.equal(captureHidden(dom), "false", "a blocked lead keeps the capture box on screen");
  assert.equal(view(dom), "failed", "and it is not dressed up as a send in progress");
  assert.equal(tick(dom).visible, false, "a blocked lead must never show a confirmation");
  assert.equal(statusText(dom), blocked, "the visitor is told exactly which step is missing");
  assert.match(statusText(dom), /Nothing has been sent/, "and that nothing went to Scott");
  assert.equal(dom.doc.getElementById("wildworks-lead-confirm").disabled, false, "Send comes back for the retry");
  assert.equal(field.value, EMAIL, "the value the visitor gave is still in the box");
}

/* ------------------------------------------------------------------ *
 * E. LEGIBILITY. The real fit loop, on real address lengths.
 * ------------------------------------------------------------------ */

// The three constants the field is fitted with, read out of the shipping file.
const FIT_MAX_REM = Number(routeSource.match(/const FIT_MAX_REM = ([\d.]+);/)?.[1]);
const FIT_MIN_REM = Number(routeSource.match(/const FIT_MIN_REM = ([\d.]+);/)?.[1]);
const FIT_RESERVE_PX = Number(routeSource.match(/const FIT_RESERVE_PX = (\d+);/)?.[1]);
assert.ok(Number.isFinite(FIT_MAX_REM) && Number.isFinite(FIT_MIN_REM) && Number.isFinite(FIT_RESERVE_PX),
  "the fit constants must still be declared in the route");
assert.ok(FIT_MIN_REM < FIT_MAX_REM, "the floor must be below the ceiling");
assert.ok(FIT_RESERVE_PX > 0, "some width must be reserved for a badge we do not control");

// The ceiling must not exceed what the CSS itself will paint, or the value is
// laid out at a size the box was never measured for - G's short address, too
// big for the field, running under the badge.
const cssClampMax = Number(valueCss.match(/font-size:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/)?.[1]);
assert.ok(Number.isFinite(cssClampMax), "the field must declare a clamped font-size");
assert.ok(FIT_MAX_REM <= cssClampMax, `fit ceiling ${FIT_MAX_REM}rem exceeds the CSS ceiling ${cssClampMax}rem`);

// Now run the REAL loop, via the real reveal path, for each length.
function fittedRem(dom, value) {
  openCapture(dom, leadState({ email: value }));
  const field = dom.doc.getElementById("wildworks-lead-value");
  return { field, rem: parseFloat(field.style.getPropertyValue("font-size")) };
}
{
  const dom = bootScript({ fetchImpl: async () => jsonResponse({ ok: true }) });
  const available = FIELD_BORDER_BOX_PX - CSS_PADDING_PX * 2 - 2 - FIT_RESERVE_PX;
  assert.ok(available > 0, "the field must leave usable width after padding and the badge reserve");

  // E1. A short address reads LARGE - G asked for that explicitly.
  const short = fittedRem(dom, "a@x.test");
  assert.equal(short.rem, FIT_MAX_REM, "a short address must sit at the ceiling");
  assert.ok(short.field.scrollWidth <= available, "even the short address must fit the content box");

  // E2. G's own short address - the one that ran under the badge.
  const g = fittedRem(dom, EMAIL);
  assert.ok(g.field.scrollWidth <= available,
    `"${EMAIL}" must stay inside the field (was ${g.field.scrollWidth}px of ${available}px)`);

  // E3. A realistically long address squeezes down and STILL fits on one line.
  //     This is the case G was worried about - "if an email address from
  //     somebody is really long, it's gotta squeeze down and be smaller print."
  const long = fittedRem(dom, LONG_EMAIL);
  assert.ok(long.rem < FIT_MAX_REM, "a long address must shrink");
  assert.ok(long.rem >= FIT_MIN_REM, "it must not shrink past the legibility floor");
  assert.ok(long.field.scrollWidth <= available,
    `a ${LONG_EMAIL.length}-character address must still fit (was ${long.field.scrollWidth}px of ${available}px)`);

  // E3b. HONEST DEGRADATION. There is no font size at which a 70+ character
  //      address fits one line in this field and is still readable, so the
  //      floor deliberately wins over fitting. What must NOT happen is a silent
  //      truncation that shows a middle fragment: the field is scrolled back to
  //      the start so the visitor sees the beginning of their own address and
  //      can tell something is cut off.
  const extreme = fittedRem(dom, EXTREME_EMAIL);
  assert.equal(extreme.rem, FIT_MIN_REM, "an extreme address bottoms out at the floor, not below it");
  assert.equal(extreme.field.scrollLeft, 0, "an overlong value must show its START, never a middle fragment");

  // E4. A dashed phone number fits at full size.
  const phoneDom = bootScript({ fetchImpl: async () => jsonResponse({ ok: true }) });
  phoneDom.win.dispatchEvent({
    type: "wildworks:lead-state",
    detail: leadState({ contactMethod: "phone", email: null, phone: PHONE }),
  });
  const phoneField = phoneDom.doc.getElementById("wildworks-lead-value");
  assert.ok(phoneField.scrollWidth <= available, "a formatted phone number must fit the field");
}

/* ------------------------------------------------------------------ *
 * F. NO SUCCESS CLAIM ANYWHERE AHEAD OF VERIFIED API STATE.
 * ------------------------------------------------------------------ */

// F1. The truth test itself must still be spelled out in the shipping source
//     and applied straight to the confirm reply: status "submitted" or a
//     submittedAt. Keeping the predicate shared prevents confirm/show drift.
assert.ok(
  /const hasSubmittedTruth = \(lead\) =>\s*lead\?\.status === "submitted" \|\| Boolean\(lead\?\.submittedAt\)/.test(routeSource),
  "the shared submission-truth predicate must require submitted/submittedAt",
);
assert.ok(
  /const submittedTruth = hasSubmittedTruth\(result\.lead\)/.test(routeSource),
  "the box must apply submission truth to the confirm API's own lead",
);

// F2. Nothing may set the sent view on optimism. Every "sent"/"submitted" view
//     assignment has to live after the reply, inside confirmLead's result
//     handling or showLead's state painting - never before the fetch.
const sendingIndex = routeSource.indexOf('setAttribute("data-box-view", "sending")');
const fetchIndex = routeSource.indexOf('fetch("/api/iscott/lead/confirm"');
assert.ok(sendingIndex > 0 && fetchIndex > sendingIndex, "the sending view is set before the request");
const beforeFetch = routeSource.slice(sendingIndex, fetchIndex);
assert.ok(!/data-box-view", "(?:sent|submitted)"/.test(beforeFetch),
  "no success view may be painted before the confirm request is even sent");
assert.ok(!/setCaptureHidden\(true\)/.test(beforeFetch),
  "the capture must not be taken away before the confirm request is even sent");

// F3. The words "sent to Scott" may only be produced by the delivered path.
//     RECEIVED_LABEL is what the merely-submitted path is allowed to say.
const receivedLabel = routeSource.match(/const RECEIVED_LABEL = "([^"]+)"/)?.[1];
assert.ok(receivedLabel, "the received-not-delivered label must exist");
assert.doesNotMatch(receivedLabel, /sent to Scott/i, "the queued label must not claim a send");

/* ------------------------------------------------------------------ *
 * G. QUALIFICATION. Nothing reaches Scott that he cannot act on, and
 *    nothing reaches him on permission the visitor never gave.
 *
 *    This drives the REAL src/lib/iscottLeadCapture.ts. Supabase is a local
 *    in-memory store behind a stubbed fetch, and the notification service is a
 *    mock that RECORDS calls. Nothing here reaches a provider or a mailbox: a
 *    recorded mock call is local evidence that the code decided to send, not
 *    evidence that any mail exists.
 * ------------------------------------------------------------------ */

const notifyStub = `export const notifyCalls = [];
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(args);
  return { queued: true, delivered: true, outboxId: "outbox-local-stub", detail: "" };
}
`;
await fs.writeFile(path.join(out, "lt-stub-notify.mjs"), notifyStub, "utf8");
await fs.writeFile(path.join(out, "lt-stub-supabase.mjs"), `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() { return { url: "https://stub.supabase.co", serviceRoleKey: "stub-key" }; }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-alerts.mjs"), `export function queueSupabaseOperationalAlert() {}
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-security.mjs"), `export function truncateUtf8String(value, limit) { return String(value ?? "").slice(0, limit); }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-traffic.mjs"), `export async function classifyTraffic() {
  return { trafficClass: "public", reason: "stub", confidence: 1 };
}
export function trafficColumns(t) {
  return { traffic_class: t.trafficClass, traffic_reason: t.reason, traffic_confidence: t.confidence };
}
`, "utf8");
// The dispatch gate is a stub with a switch on it, so the test-held branch can
// be exercised without touching traffic classification. Default is open, which
// is what every check written before this one assumed.
await fs.writeFile(path.join(out, "lt-stub-resolve.mjs"), `export const ISCOTT_TEST_HELD_STATUS = "test_held";
export const dispatch = { allowed: true };
export function canDispatchIScottLeadNotification() { return dispatch.allowed; }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-ui.mjs"), `export { visitorChoseContactMethod } from "./lt-iscottLeadParsing.mjs";
`, "utf8");
// The visitor receipt ships disabled. These checks are about Scott's copy, so
// the gate is held at its shipped value here.
await fs.writeFile(path.join(out, "lt-stub-visitor-confirmation.mjs"), `export const ISCOTT_VISITOR_CONFIRMATION_ENABLED = false;
export const ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS = "approval_required";
`, "utf8");

await transpile("src/lib/iscottLeadCapture.ts", [
  ['from "./iscottLeadParsing"', 'from "./lt-iscottLeadParsing.mjs"'],
  ['from "./iscottVisitorConfirmation"', 'from "./lt-stub-visitor-confirmation.mjs"'],
  ['from "./iscottLeadCaptureUi"', 'from "./lt-stub-ui.mjs"'],
  ['from "./voiceEmailNotifications"', 'from "./lt-stub-notify.mjs"'],
  ['from "./supabaseAdmin"', 'from "./lt-stub-supabase.mjs"'],
  ['from "./wildworksOperationalAlerts"', 'from "./lt-stub-alerts.mjs"'],
  ['from "./apiRouteSecurity"', 'from "./lt-stub-security.mjs"'],
  ['from "./trafficClassification"', 'from "./lt-stub-traffic.mjs"'],
  ['from "./iscottTrafficResolve"', 'from "./lt-stub-resolve.mjs"'],
]);
const Capture = await import(url("iscottLeadCapture"));
const Notify = await import(url("stub-notify"));
const Resolve = await import(url("stub-resolve"));

// An in-memory Supabase. Every write is visible to the test, so "the row was
// never marked accepted" is something we can actually check rather than assume.
function leadBackend(row, messages = [], outbox = null) {
  const store = { row: row ? { ...row } : null };
  const writes = [];
  const reply = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => "" });
  const fetchImpl = async (target, init = {}) => {
    const resource = String(target).split("/rest/v1/")[1] ?? String(target);
    const method = init.method ?? "GET";
    if (resource.startsWith("iscott_leads")) {
      if (method === "POST") {
        const incoming = JSON.parse(init.body)[0];
        writes.push(incoming);
        store.row = { ...(store.row ?? {}), ...incoming };
        return reply([store.row]);
      }
      return reply(store.row ? [store.row] : []);
    }
    // The stored conversation. This is the PROOF the confirm path reads before
    // it qualifies anything - a lead row's own consent columns are a conclusion,
    // and a conclusion with no conversation behind it is exactly the stale row
    // this correction exists to refuse.
    if (resource.startsWith("conversation_messages")) return reply(messages);
    // The row the notification outbox already holds for this lead, when the test
    // is about a package that has ALREADY gone.
    if (resource.startsWith("voice_email_outbox")) return reply(outbox ? [outbox] : []);
    return reply([]);
  };
  return { store, writes, fetchImpl };
}

// Turns as the sync route persists them, ready to be served back.
const persisted = (rows) => rows.map((row) => ({
  role: row.role,
  message: row.message,
  la_absolute_timestamp: row.laAbsoluteTimestamp ?? null,
}));

const QUALIFIED_ROW = {
  session_id: SESSION,
  anonymous_visitor_id: null,
  source_route: "/pages/avatar-iscott",
  status: "ready_for_confirmation",
  consent_status: "accepted",
  full_name: "Jennifer Mcallister",
  location: "Northlake",
  project_need: "A pool and a waterfall out back",
  contact_method: "email",
  email: EMAIL,
  phone: null,
  contact_confirmed_at: "2026-08-29T15:00:00.000Z",
  submitted_at: null,
  notification_outbox_id: null,
  notification_status: null,
  traffic_class: "public",
  traffic_reason: "stub",
  traffic_confidence: 1,
  transcript_text: "",
  transcript_snapshot: [],
  media_snapshot: [],
  metadata: {},
  created_at: "2026-08-29T14:00:00.000Z",
  updated_at: "2026-08-29T14:00:00.000Z",
};

const realFetch = globalThis.fetch;
async function withBackend(row, run, messages = [], outbox = null) {
  const backend = leadBackend(row, messages, outbox);
  Notify.notifyCalls.length = 0;
  globalThis.fetch = backend.fetchImpl;
  try {
    return { backend, result: await run(backend) };
  } finally {
    globalThis.fetch = realFetch;
  }
}

// The conversation that earns a send: the address read back exactly, the
// visitor agreeing, the send question, and the plain "Yes." G actually said.
const PROOF_TURNS = [
  { role: "assistant", message: `I have your email as ${EMAIL}. Did I get that right?`, laAbsoluteTimestamp: 16 },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 },
  { role: "assistant", message: ASK, laAbsoluteTimestamp: 20 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 },
];

// G1. A COMPLETE LEAD GOES. Name, a job Scott can quote, confirmed contact,
//     stored consent - AND a stored conversation that proves the address was
//     read back and agreed to. The notification service is asked exactly once.
{
  const { result, backend } = await withBackend(
    QUALIFIED_ROW,
    () => Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
    persisted(PROOF_TURNS),
  );
  assert.equal(result.queued, true, "a qualified lead is handed to the notification service");
  assert.equal(Notify.notifyCalls.length, 1, "exactly one notification attempt");
  assert.equal(Notify.notifyCalls[0].email, EMAIL, "and it carries the address the visitor confirmed");
  assert.equal(backend.store.row.status, "submitted");
}

// G1b. THE STALE ROW. 2026-08-29 correction. consent_status "accepted" and a
//      contact_confirmed_at are the CONCLUSION the capture pipeline reached -
//      a row written before the strict read-back rule existed carries them with
//      nothing behind them, and a direct POST to /api/iscott/lead/confirm could
//      spend that conclusion. The proof is read now, ahead of any write.
{
  const { backend } = await withBackend(QUALIFIED_ROW, async (b) => {
    await assert.rejects(
      Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
      (error) => {
        assert.equal(error.message, "lead_not_qualified:no_exact_contact_consent",
          "a lead with no conversation behind its consent is refused");
        return true;
      },
    );
    return b;
  }); // no persisted messages, and QUALIFIED_ROW carries no snapshot either
  assert.equal(Notify.notifyCalls.length, 0, "a stale accepted row never reaches the notification service");
  assert.equal(backend.writes.length, 0, "and nothing is written on the way to refusing it");
  assert.equal(backend.store.row.status, "ready_for_confirmation", "the row is left exactly where it was");
  assert.equal(backend.store.row.consent_status, "accepted", "its columns are read, never rewritten");
}

// G1c. A conversation that says a yes but never reads the address back is not
//      proof either. This is the generic "May I send these details to Scott?"
//      that cost G the lead on ride b1dd603f - a real yes about nothing exact.
{
  const { backend } = await withBackend(
    QUALIFIED_ROW,
    async (b) => {
      await assert.rejects(
        Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
        (error) => {
          assert.equal(error.message, "lead_not_qualified:no_exact_contact_consent");
          return true;
        },
      );
      return b;
    },
    persisted([
      { role: "assistant", message: ASK, laAbsoluteTimestamp: 20 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 },
    ]),
  );
  assert.equal(Notify.notifyCalls.length, 0, "a yes with no read-back behind it sends nothing");
  assert.equal(backend.writes.length, 0);
}

// G1d. And a stored command with no read-back is refused on the same grounds -
//      the send-command bypass is gone from the strict gate.
{
  const { backend } = await withBackend(
    QUALIFIED_ROW,
    async (b) => {
      await assert.rejects(
        Capture.confirmAndSubmitIScottLead({ sessionId: SESSION, contactMethod: "email", contactValue: EMAIL }),
        (error) => {
          assert.equal(error.message, "lead_not_qualified:no_exact_contact_consent");
          return true;
        },
      );
      return b;
    },
    persisted([{ role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 22 }]),
  );
  assert.equal(Notify.notifyCalls.length, 0, "a bare command cannot mint a send through the API either");
  assert.equal(backend.writes.length, 0);
}

// G2-G6. EVERY BLOCKED CASE. The confirm API refuses, names why, and the
//        notification mock is NEVER invoked.
for (const [label, override, reason, request] of [
  ["a lead with no name", { full_name: null }, "missing_full_name", { contactValue: EMAIL }],
  ["a lead with a generic intent", { project_need: "Landscaping" }, "generic_project_need", { contactValue: EMAIL }],
  ["a lead with no intent at all", { project_need: null }, "generic_project_need", { contactValue: EMAIL }],
  [
    "a direct API call on a lead that never consented",
    { consent_status: "unknown", contact_confirmed_at: null },
    "consent_not_accepted",
    { contactValue: EMAIL },
  ],
  [
    "a direct API call naming a contact the lead does not hold",
    {},
    "contact_mismatch",
    { contactValue: OTHER_EMAIL },
  ],
]) {
  const row = { ...QUALIFIED_ROW, ...override };
  const { backend } = await withBackend(row, async (b) => {
    await assert.rejects(
      Capture.confirmAndSubmitIScottLead({
        sessionId: SESSION,
        contactMethod: "email",
        contactValue: request.contactValue,
      }),
      (error) => {
        assert.equal(error.message, `lead_not_qualified:${reason}`, `${label} must be refused as ${reason}`);
        return true;
      },
      label,
    );
    return b;
  });
  assert.equal(Notify.notifyCalls.length, 0, `${label} must never reach the notification service`);
  assert.equal(backend.writes.length, 0, `${label} must not write anything to the lead row`);
  assert.equal(backend.store.row.consent_status, row.consent_status,
    `${label} must not manufacture consent`);
  assert.equal(backend.store.row.contact_confirmed_at, row.contact_confirmed_at,
    `${label} must not manufacture a contact confirmation`);
  assert.equal(backend.store.row.status, "ready_for_confirmation", `${label} leaves the lead where it was`);
}

/* ------------------------------------------------------------------ *
 * H. THE SAME GATE ON THE SPOKEN PATH, through the real capture pipeline.
 * ------------------------------------------------------------------ */

const NAME_TURN = { role: "user", message: "My name is Jennifer Mcallister.", laAbsoluteTimestamp: 10 };
const PROJECT_TURN = { role: "user", message: "I want a pool and a waterfall out back.", laAbsoluteTimestamp: 12 };
const EMAIL_TURN = { role: "user", message: `My email is ${EMAIL}.`, laAbsoluteTimestamp: 14 };
const READBACK_TURN = {
  role: "assistant",
  message: `I have your email as ${EMAIL}. Did I get that right?`,
  laAbsoluteTimestamp: 16,
};
const ASK_TURN = { role: "assistant", message: ASK, laAbsoluteTimestamp: 20 };
const YES_TURN = { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 };

async function ride(rows) {
  return withBackend(null, () =>
    Capture.processIScottTranscriptRows({ sessionId: SESSION, route: "/pages/avatar-iscott", rows }));
}

// H1. THE WHOLE HONEST RIDE. Read-back, confirmation, the send question, a
//     plain "Yes." - and the send actually fires.
{
  const { result, backend } = await ride([
    NAME_TURN,
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK_TURN,
    { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 },
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(backend.store.row.consent_status, "accepted", "the read-back ride earns stored consent");
  assert.ok(backend.store.row.contact_confirmed_at, "and a contact confirmation");
  assert.equal(Notify.notifyCalls.length, 1, "a qualified spoken ride sends once");
  assert.equal(result.status, "submitted");
}

// H2. THE SAME RIDE WITHOUT THE READ-BACK. iScott asked a generic question and
//     got a real yes. Nobody confirmed WHICH address it was about, so no
//     consent is stored and nothing is sent.
{
  const { backend } = await ride([NAME_TURN, PROJECT_TURN, EMAIL_TURN, ASK_TURN, YES_TURN]);
  assert.equal(backend.store.row.consent_status, "unknown", "a generic ASK + Yes stores no consent");
  assert.equal(backend.store.row.contact_confirmed_at, null, "and no contact confirmation");
  assert.equal(Notify.notifyCalls.length, 0, "and the notification service is never asked");
}

// H3. NO NAME. The consent is real and the contact was read back, and it still
//     does not go - Scott cannot use a lead he cannot address.
{
  const { backend } = await ride([
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK_TURN,
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(backend.store.row.full_name, null, "no name was ever given");
  assert.equal(backend.store.row.consent_status, "accepted", "the consent itself is genuine");
  assert.equal(Notify.notifyCalls.length, 0, "a nameless lead is never sent");
}

// H4. NO SPECIFIC PROJECT. Same story: a confirmed address attached to nothing
//     Scott can quote is not a lead worth his afternoon.
{
  const { backend } = await ride([
    NAME_TURN,
    { role: "user", message: "I want some landscaping.", laAbsoluteTimestamp: 12 },
    EMAIL_TURN,
    READBACK_TURN,
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(backend.store.row.consent_status, "accepted");
  assert.doesNotMatch(String(backend.store.row.project_need ?? ""), /pool|waterfall/i);
  assert.equal(Notify.notifyCalls.length, 0, "a lead with only a generic intent is never sent");
}

// H5. A CHANGED ADDRESS after the read-back invalidates the consent that stood
//     on the old one. The lead waits; it is not mailed to either address.
{
  const { backend } = await ride([
    NAME_TURN,
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK_TURN,
    ASK_TURN,
    { role: "user", message: `Actually use ${OTHER_EMAIL} instead.`, laAbsoluteTimestamp: 22 },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: 24 },
  ]);
  assert.equal(backend.store.row.email, OTHER_EMAIL, "the new address is what the lead now holds");
  assert.equal(backend.store.row.consent_status, "unknown", "consent does not carry to a replaced address");
  assert.equal(Notify.notifyCalls.length, 0, "and nothing is sent to either one");
}

// H6. GENERIC INTENT, CORRECTED 2026-08-29. The block used to match a whole
//     phrase only, so stacking two vague words walked through it. Every ride
//     here is a real sentence a visitor says, and none of them is a job Scott
//     can quote from - so none of them travels, however good the consent is.
for (const vague of [
  "I want some landscaping.",
  "I need some help.",
  "I need help with a project.",
  "We want a landscaping project.",
]) {
  const { backend } = await ride([
    NAME_TURN,
    { role: "user", message: vague, laAbsoluteTimestamp: 12 },
    EMAIL_TURN,
    READBACK_TURN,
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(backend.store.row.consent_status, "accepted", `"${vague}": the consent itself is genuine`);
  assert.equal(Notify.notifyCalls.length, 0, `"${vague}" is not a job Scott can act on, so nothing is sent`);
}

// H7. ONE WORD CAN BE THE WHOLE NAME, 2026-08-30. This ride used to assert the
//     opposite: everything else about it was valid, and the lead was held
//     because "Solveig" is a single token. That is a real answer from a real
//     visitor, and holding it meant iScott asked for the name again and the
//     lead never travelled. A name that is not a placeholder, a contact value
//     or a field label is a name.
{
  const { backend } = await ride([
    { role: "user", message: "My name is Solveig.", laAbsoluteTimestamp: 10 },
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK_TURN,
    { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 },
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(backend.store.row.full_name, "Solveig", "the single-word name is what the lead holds");
  assert.equal(Notify.notifyCalls.length, 1, "and a complete package with it reaches Scott");
}

// H8. A PLACEHOLDER IS NOT A NAME. Scott is going to ring these people.
for (const placeholder of ["My name is Test.", "My name is Unknown.", "I'm Anonymous."]) {
  const { backend } = await ride([
    { role: "user", message: placeholder, laAbsoluteTimestamp: 10 },
    PROJECT_TURN,
    EMAIL_TURN,
    READBACK_TURN,
    ASK_TURN,
    YES_TURN,
  ]);
  assert.equal(Notify.notifyCalls.length, 0, `"${placeholder}" must never reach Scott as a name`);
}

/* ------------------------------------------------------------------ *
 * I. THE CONFIRM ROUTE tells the visitor the truth about a blocked lead.
 * ------------------------------------------------------------------ */

const confirmRoute = await fs.readFile(path.resolve("app/api/iscott/lead/confirm/route.ts"), "utf8");
// 2026-08-29. The route used to recognise a refusal by testing whether an
// Error's MESSAGE started with "lead_not_qualified:" and slicing the reason out
// of the rest. It reads the typed reason now, so what the visitor is told no
// longer depends on the shape of a sentence.
assert.match(confirmRoute, /leadNotQualifiedReason\(error\)/, "the route reads a TYPED qualification refusal");
assert.doesNotMatch(
  confirmRoute,
  /detail\.startsWith\(|detail\.slice\(/,
  "the route must not parse a refusal out of a free-form message",
);
assert.match(confirmRoute, /qualificationReason \? 409 : 500/, "a qualification refusal is a 409, not a 500");
assert.match(confirmRoute, /isValidation \? 400/, "a bad value is a 400, not a 500");
assert.match(confirmRoute, /Nothing has been sent/, "a blocked lead is told plainly that nothing went");

// I2. EVERY MISSING STEP HAS ITS OWN WORDS, 2026-08-29. A 409 is not an error
//     the visitor caused - it is a step of the conversation that has not
//     happened yet - so each one names the step and says what to do next.
for (const [reason, must] of [
  ["missing_full_name", /still needs your name/i],
  ["generic_project_need", /what you want Scott to help with/i],
  ["no_exact_contact_consent", /has not read that back to you/i],
  ["consent_not_accepted", /does not have your permission/i],
  ["contact_not_confirmed", /does not have your permission/i],
]) {
  assert.match(confirmRoute, new RegExp(`"${reason}"`), `the route must recognise ${reason}`);
  assert.match(confirmRoute, must, `${reason} must have its own visitor-safe copy`);
}
// None of them may blame the visitor or claim a send.
const copyLines = confirmRoute.match(/"Nothing has been sent\.[^"]*"/g) ?? [];
assert.ok(copyLines.length >= 5, `expected a missing-step line per blocker, found ${copyLines.length}`);
for (const line of copyLines) {
  assert.doesNotMatch(line, /error|invalid|failed|sorry/i, `409 copy must not read like a fault: ${line}`);
}
// And the client keeps the box and the retry behind them. The 409 arrives as a
// non-ok response, which lands in confirmLead's catch: capture restored, the
// server's own wording on screen, Send live again.
const confirmBlock = routeSource.slice(
  routeSource.indexOf("const confirmLead ="),
  routeSource.indexOf("const showLead ="),
);
assert.match(
  confirmBlock,
  /catch \(error\) \{[\s\S]{0,400}setCaptureHidden\(false\)/,
  "a refused send keeps the capture box up",
);
assert.match(
  confirmBlock,
  /catch \(error\) \{[\s\S]{0,600}button\.disabled = false/,
  "and Send comes back so the visitor can finish the missing step and retry",
);
assert.match(
  confirmBlock,
  /throw new Error\(result\?\.error \|\|/,
  "the server's own missing-step wording is what the visitor is shown",
);

/* ------------------------------------------------------------------ *
 * J. IDEMPOTENCY IS ABOUT THE PERSON, NOT THE PUNCTUATION.
 *
 *    2026-08-29 correction. Several comparisons that decide whether a lead has
 *    ALREADY been handed to Scott compared contact strings with ===. A phone
 *    the visitor re-said without the country code, or an address stored with a
 *    capital letter, read as a DIFFERENT contact - so the "we already sent
 *    this" guards fell open and Scott got the same lead twice, while a visitor
 *    who simply repeated their own number had their confirmed consent torn
 *    down and had to do the read-back again.
 *
 *    Same in-memory backend, same notification mock. Nothing here reaches a
 *    provider or a mailbox.
 * ------------------------------------------------------------------ */

const PHONE_HELD = "4435550142";
// What an earlier package actually stamped: the visitor said "plus one ..." so
// the stored value carried the country code the later turns dropped.
const PHONE_WITH_COUNTRY_CODE = "+14435550142";
const OTHER_PHONE = "4435550199";
const CASED_EMAIL = "Visitor@Example.com";
const CONFIRMED_AT = "2026-08-29T15:00:00.000Z";

const phoneProof = (spoken) => [
  { role: "assistant", message: `I have your phone as ${spoken}. Did I get that right?`, laAbsoluteTimestamp: 16 },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 },
  { role: "assistant", message: ASK, laAbsoluteTimestamp: 20 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 },
];
const PHONE_PROOF = phoneProof("443-555-0142");
const emailProof = (address) => [
  { role: "assistant", message: `I have your email as ${address}. Did I get that right?`, laAbsoluteTimestamp: 16 },
  { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 18 },
  { role: "assistant", message: ASK, laAbsoluteTimestamp: 20 },
  { role: "user", message: "Yes.", laAbsoluteTimestamp: 22 },
];

const PHONE_ROW = {
  ...QUALIFIED_ROW,
  contact_method: "phone",
  email: null,
  phone: PHONE_HELD,
  contact_confirmed_at: CONFIRMED_AT,
};

// J1. AUTO-SEND DUPLICATE SUPPRESSION. The package already went to this person;
//     the stamp of where it went just carries the country code the row no
//     longer does. Compared literally that is a new contact and Scott gets the
//     same lead a second time.
{
  const { backend } = await withBackend(
    {
      ...PHONE_ROW,
      status: "submitted",
      submitted_at: CONFIRMED_AT,
      notification_outbox_id: "outbox-earlier",
      notification_status: "sent",
      metadata: { last_sent_contact: PHONE_WITH_COUNTRY_CODE },
      transcript_snapshot: PHONE_PROOF,
    },
    () => Capture.processIScottTranscriptRows({
      sessionId: SESSION,
      route: "/pages/avatar-iscott",
      rows: [{ role: "user", message: "Just to be sure, my number is (443) 555-0142.", laAbsoluteTimestamp: 30 }],
    }),
    persisted(PHONE_PROOF),
    // Deliberately no outbox row behind this one. The guard under test is the
    // auto-send suppression itself; the outbox short-circuit is a SECOND net,
    // and a test that leans on it cannot see the first one fail. (J2 is that
    // second net's own test.)
    null,
  );
  assert.equal(
    Notify.notifyCalls.length,
    0,
    "a re-formatted repeat of the phone Scott already has must not send him the lead twice",
  );
  assert.equal(backend.store.row.status, "submitted", "the lead stays where it was");
}

// J1b. AND THE SUPPRESSION IS ABOUT THE VALUE, NOT A BLANKET STOP. A lead whose
//      last package went to a genuinely different number is still unsent for
//      the number it holds now, and it travels.
{
  await withBackend(
    {
      ...PHONE_ROW,
      metadata: { last_sent_contact: OTHER_PHONE },
      transcript_snapshot: PHONE_PROOF,
    },
    () => Capture.processIScottTranscriptRows({
      sessionId: SESSION,
      route: "/pages/avatar-iscott",
      rows: [{ role: "user", message: "Just to be sure, my number is (443) 555-0142.", laAbsoluteTimestamp: 30 }],
    }),
    persisted(PHONE_PROOF),
  );
  assert.equal(Notify.notifyCalls.length, 1, "a package for a contact Scott has not been given still goes");
  assert.equal(Notify.notifyCalls[0].phone, PHONE_HELD, "and it carries the number the lead holds now");
}

// J2. THE SUBMITTED/OUTBOX SHORT-CIRCUIT. The visitor presses Send again on a
//     lead that has already gone. The address they type differs from the stored
//     one only in case and surrounding space - the same mailbox - so this must
//     report the EXISTING outbox row, not build a second package.
{
  const { result, backend } = await withBackend(
    {
      ...QUALIFIED_ROW,
      email: CASED_EMAIL,
      contact_confirmed_at: CONFIRMED_AT,
      status: "submitted",
      submitted_at: CONFIRMED_AT,
      notification_outbox_id: "outbox-77",
      notification_status: "sent",
      metadata: { last_sent_contact: CASED_EMAIL },
      transcript_snapshot: emailProof(CASED_EMAIL),
    },
    () => Capture.confirmAndSubmitIScottLead({
      sessionId: SESSION,
      contactMethod: "email",
      contactValue: "  visitor@example.com  ",
    }),
    persisted(emailProof(CASED_EMAIL)),
    { id: "outbox-77", status: "sent" },
  );
  assert.equal(Notify.notifyCalls.length, 0, "a second Send on the same mailbox must not mail Scott again");
  assert.equal(backend.writes.length, 0, "and nothing is rewritten on the way to answering");
  assert.equal(result.delivered, true, "the visitor is told the truth from the outbox row that exists");
  assert.equal(result.detail, "");
}

// J3. THE TEST-HELD SHORT-CIRCUIT. A parked QA lead pressed again, with the
//     number typed in a different shape. It stays parked and untouched - the
//     old comparison walked past this guard and rewrote the row.
{
  Resolve.dispatch.allowed = false;
  try {
    const { result, backend } = await withBackend(
      {
        ...PHONE_ROW,
        phone: PHONE_WITH_COUNTRY_CODE,
        status: "confirmed",
        notification_status: "test_held",
        transcript_snapshot: phoneProof("443-555-0142"),
      },
      () => Capture.confirmAndSubmitIScottLead({
        sessionId: SESSION,
        contactMethod: "phone",
        contactValue: "(443) 555-0142",
      }),
      persisted(phoneProof("443-555-0142")),
    );
    assert.equal(result.detail, "test_traffic_not_sent", "a held lead is still reported as held");
    assert.equal(Notify.notifyCalls.length, 0, "and nothing is sent");
    assert.equal(backend.writes.length, 0, "a lead already parked as held is left exactly as it is");
  } finally {
    Resolve.dispatch.allowed = true;
  }
}

// J4. A RE-SAID CONTACT IS NOT A CHANGED CONTACT. The visitor repeats their own
//     number, dropping the country code they said the first time. Their
//     confirmed consent must survive it - tearing it down here is what sent
//     them back through the whole read-back for saying nothing new.
for (const [label, row, turn, method] of [
  [
    "the same number without the country code",
    { ...PHONE_ROW, phone: PHONE_WITH_COUNTRY_CODE, transcript_snapshot: [] },
    "Actually, it's (443) 555-0142.",
    "phone",
  ],
  [
    "the same mailbox in different case",
    {
      ...QUALIFIED_ROW,
      email: CASED_EMAIL,
      contact_confirmed_at: CONFIRMED_AT,
      transcript_snapshot: [],
    },
    "Actually, it's visitor@example.com.",
    "email",
  ],
]) {
  const { backend } = await withBackend(row, () => Capture.processIScottTranscriptRows({
    sessionId: SESSION,
    route: "/pages/avatar-iscott",
    rows: [{ role: "user", message: turn, laAbsoluteTimestamp: 30 }],
  }));
  assert.equal(backend.store.row.consent_status, "accepted", `${label} must not cost the visitor their consent`);
  assert.equal(
    backend.store.row.contact_confirmed_at,
    CONFIRMED_AT,
    `${label} must not throw away the confirmation they already earned`,
  );
  assert.equal(Notify.notifyCalls.length, 0, `${label}: no read-back in these rows, so nothing is sent either`);
  // And it is still the SAME person: whatever shape the row now stores, it
  // normalizes to the contact the visitor confirmed in the first place.
  const held = method === "phone" ? backend.store.row.phone : backend.store.row.email;
  const before = method === "phone" ? row.phone : row.email;
  assert.equal(P.sameContactValue(method, held, before), true, `${label} is still the same contact`);
}

// J4b. A REAL CHANGE STILL INVALIDATES. This is the behaviour the correction
//      had to keep: a different way to reach the visitor is unconfirmed until
//      they hear it read back and say yes again.
for (const [label, row, turn] of [
  [
    "a different phone number",
    { ...PHONE_ROW, transcript_snapshot: [] },
    "Actually, it's (443) 555-0199.",
  ],
  [
    "a different address",
    { ...QUALIFIED_ROW, email: CASED_EMAIL, contact_confirmed_at: CONFIRMED_AT, transcript_snapshot: [] },
    `Actually, it's ${OTHER_EMAIL}.`,
  ],
]) {
  const { backend } = await withBackend(row, () => Capture.processIScottTranscriptRows({
    sessionId: SESSION,
    route: "/pages/avatar-iscott",
    rows: [{ role: "user", message: turn, laAbsoluteTimestamp: 30 }],
  }));
  assert.equal(backend.store.row.consent_status, "unknown", `${label} invalidates the consent that stood on the old one`);
  assert.equal(backend.store.row.contact_confirmed_at, null, `${label} invalidates the confirmation too`);
  assert.equal(Notify.notifyCalls.length, 0, `${label} sends nothing to either contact`);
}

// J5. metadata IS FREE-FORM JSON. Something other than a string in
//     last_sent_contact used to be truthy enough to defeat the "this lead has
//     already been sent" fallback while matching nothing - so a lead that had
//     gone was auto-sent all over again. It is read as a string or not at all.
{
  await withBackend(
    {
      ...PHONE_ROW,
      status: "submitted",
      submitted_at: CONFIRMED_AT,
      notification_outbox_id: "outbox-9",
      notification_status: "sent",
      metadata: { last_sent_contact: { value: PHONE_HELD } },
      transcript_snapshot: PHONE_PROOF,
    },
    () => Capture.processIScottTranscriptRows({
      sessionId: SESSION,
      route: "/pages/avatar-iscott",
      rows: [{ role: "user", message: "Thanks, that is everything.", laAbsoluteTimestamp: 30 }],
    }),
    persisted(PHONE_PROOF),
    // No outbox row to fall back on: if the auto-send is not suppressed here,
    // it reaches the notification service, which is the whole failure.
    null,
  );
  assert.equal(
    Notify.notifyCalls.length,
    0,
    "a junk value in last_sent_contact must not resend a lead Scott already has",
  );
}

/* ------------------------------------------------------------------ *
 * K. THE CONFIRM ROUTE'S OWN STATUS MAPPING, driven through the REAL
 *    route handler with every dependency stubbed in memory. No network,
 *    no Supabase, no provider - the capture call is a mock that throws
 *    whatever the case under test needs it to throw.
 * ------------------------------------------------------------------ */

await fs.writeFile(path.join(out, "lt-stub-route-security.mjs"), `export function assertAllowedOrigin() { return null; }
export function isSafeTranscriptionSessionId(id) { return typeof id === "string" && /^[A-Za-z0-9_-]{4,120}$/.test(id); }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-route-rate.mjs"), `export async function checkRateLimit() { return null; }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-route-telemetry.mjs"), `export const telemetry = [];
export async function logServerTelemetryEvent(event) { telemetry.push(event); }
`, "utf8");
await fs.writeFile(path.join(out, "lt-stub-route-capture.mjs"), `export const state = {
  behaviour: async () => ({ lead: null, queued: true, delivered: true, detail: "" }),
};
export async function confirmAndSubmitIScottLead(args) { return state.behaviour(args); }
`, "utf8");

await transpile("app/api/iscott/lead/confirm/route.ts", [
  ['from "../../../../../src/lib/apiRouteSecurity"', 'from "./lt-stub-route-security.mjs"'],
  ['from "../../../../../src/lib/iscottLeadCapture"', 'from "./lt-stub-route-capture.mjs"'],
  ['from "../../../../../src/lib/iscottLeadParsing"', 'from "./lt-iscottLeadParsing.mjs"'],
  ['from "../../../../../src/lib/rateLimit"', 'from "./lt-stub-route-rate.mjs"'],
  ['from "../../../../../src/lib/serverTelemetryCapture"', 'from "./lt-stub-route-telemetry.mjs"'],
]);
const Route = await import(url("route"));
const RouteCapture = await import(url("stub-route-capture"));
const RouteTelemetry = await import(url("stub-route-telemetry"));

const postConfirm = (body) => Route.POST(new Request("https://wildworks.ai/api/iscott/lead/confirm", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}));
const goodBody = { sessionId: SESSION, contactMethod: "email", contactValue: EMAIL };

// K1. EVERY STRUCTURED REASON IS A 409 CARRYING ITS OWN MISSING-STEP WORDING.
for (const [reason, must] of [
  ["missing_full_name", /still needs your name/i],
  ["generic_project_need", /what you want Scott to help with/i],
  ["missing_contact", /a way for Scott to reach you/i],
  ["contact_mismatch", /does not match the contact/i],
  ["no_exact_contact_consent", /has not read that back to you/i],
  ["consent_not_accepted", /does not have your permission/i],
  ["contact_not_confirmed", /does not have your permission/i],
]) {
  RouteCapture.state.behaviour = async () => { throw new P.LeadNotQualifiedError({ reason }); };
  RouteTelemetry.telemetry.length = 0;
  const response = await postConfirm(goodBody);
  const body = await response.json();
  assert.equal(response.status, 409, `${reason} must be a 409, never a 500`);
  assert.equal(body.ok, false);
  assert.match(body.error, must, `${reason} must arrive with its own missing-step wording`);
  assert.match(body.error, /Nothing has been sent/, `${reason} must say plainly that nothing went`);
  assert.doesNotMatch(body.error, /error|invalid|failed|sorry/i, `${reason} must not read like a fault`);
  const event = RouteTelemetry.telemetry.at(-1);
  assert.equal(event.severity, "low", `${reason} is a missing step, not an incident`);
  assert.equal(event.userVisibleState, "not_qualified");
  assert.equal(event.payload.detail, `lead_not_qualified:${reason}`, "the logged wording is unchanged");
}

// K2. AND NOTHING ELSE IS A 409. An ordinary failure - including one whose
//     message merely LOOKS like a refusal, which the old string-prefix rule
//     would have handed the visitor as a 409 - is an honest 500.
for (const [label, thrown] of [
  ["an ordinary failure", new Error("boom")],
  ["prose shaped like a refusal", new Error("lead_not_qualified:no_exact_contact_consent")],
  ["a refusal carrying a reason nobody has words for", { leadNotQualified: true, reason: "something_invented" }],
  ["a supabase read failure", new Error("iscott_leads read failed (500): ")],
]) {
  RouteCapture.state.behaviour = async () => { throw thrown; };
  RouteTelemetry.telemetry.length = 0;
  const response = await postConfirm(goodBody);
  const body = await response.json();
  assert.equal(response.status, 500, `${label} must stay a 500`);
  assert.equal(body.ok, false);
  assert.match(body.error, /could not finish the handoff yet/i, `${label} gets the generic wording`);
  assert.equal(RouteTelemetry.telemetry.at(-1).severity, "high", `${label} is a real incident`);
}

// K3. A BAD VALUE IS STILL THE VISITOR'S 400, and a good send is still a 200.
for (const [detail, status, must] of [
  ["invalid_email", 400, /email address does not look complete/i],
  ["invalid_phone", 400, /phone number does not look complete/i],
]) {
  RouteCapture.state.behaviour = async () => { throw new Error(detail); };
  const response = await postConfirm(goodBody);
  assert.equal(response.status, status, `${detail} is a 400`);
  assert.match((await response.json()).error, must);
}
{
  RouteCapture.state.behaviour = async () => ({ lead: null, queued: true, delivered: true, detail: "" });
  const response = await postConfirm(goodBody);
  assert.equal(response.status, 200, "a delivered send is a 200");
  assert.equal((await response.json()).ok, true);
  const failed = await (async () => {
    RouteCapture.state.behaviour = async () => ({ lead: null, queued: false, delivered: false, detail: "voice_email_failed" });
    return postConfirm(goodBody);
  })();
  assert.equal(failed.status, 503, "a send the notification service could not queue is a 503");
}
// And the route still refuses malformed input before it asks the gate anything.
for (const bad of [
  { sessionId: "", contactMethod: "email", contactValue: EMAIL },
  { sessionId: SESSION, contactMethod: "carrier pigeon", contactValue: EMAIL },
  { sessionId: SESSION, contactMethod: "email", contactValue: "   " },
]) {
  RouteCapture.state.behaviour = async () => { throw new Error("the gate must not have been reached"); };
  assert.equal((await postConfirm(bad)).status, 400, `malformed input is a 400: ${JSON.stringify(bad)}`);
}

console.log("iScott lead-truth checks passed (consent, qualification, contact idempotency, typed 409/500 mapping, field, box states, legibility, no premature claim).");
