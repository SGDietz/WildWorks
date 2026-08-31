// Isolated UI truth checks for inconsistent sent rows and failed submitted
// rows. This executes the real injected lead-confirmation script against a
// tiny local DOM. No provider, Supabase, email, or network call can escape:
// fetch is a synthetic stub in every case.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const routeSource = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");
const scriptBlock = routeSource.match(/const wildWorksLeadConfirmationScript = `([\s\S]*?)\n`;/);
assert.ok(scriptBlock, "lead-confirmation script must remain extractable");
const scriptBody = scriptBlock[1]
  .replace(/^\s*<script id="wildworks-avatar-lead-confirmation">/, "")
  .replace(/<\/script>\s*$/, "");

const VOID_TAGS = new Set(["input", "br", "img", "hr", "meta", "link"]);

function parseAttrs(raw) {
  const attrs = {};
  const re = /([:@a-zA-Z_][-:.\w]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(raw))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

class ElementStub {
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
      values: {},
      setProperty(name, value) { this.values[name] = value; },
      removeProperty(name) { delete this.values[name]; },
      getPropertyValue(name) { return this.values[name] ?? ""; },
    };
    this.classList = {
      values: new Set(),
      add: (name) => this.classList.values.add(name),
      remove: (name) => this.classList.values.delete(name),
      contains: (name) => this.classList.values.has(name),
    };
  }
  setAttribute(name, value) { this.attributes[String(name).toLowerCase()] = String(value); }
  get id() { return this.getAttribute("id") ?? ""; }
  set id(value) { this.setAttribute("id", value); }
  getAttribute(name) {
    const value = this.attributes[String(name).toLowerCase()];
    return value === undefined ? null : value;
  }
  removeAttribute(name) { delete this.attributes[String(name).toLowerCase()]; }
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  removeEventListener() {}
  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(html) {
    this.children = [];
    this._text = "";
    const stack = [this];
    const token = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;
    let match;
    while ((match = token.exec(html))) {
      if (match[3] !== undefined) {
        if (match[3].trim()) stack.at(-1)._text += match[3].trim();
        continue;
      }
      const tag = match[1].toLowerCase();
      const rest = match[2] ?? "";
      if (match[0].startsWith("</")) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const child = new ElementStub(tag);
      const attrs = parseAttrs(rest.replace(/\/\s*$/, ""));
      for (const [name, value] of Object.entries(attrs)) child.attributes[name] = value;
      if ("hidden" in attrs) child.hidden = true;
      stack.at(-1).appendChild(child);
      if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rest)) stack.push(child);
    }
  }
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  matches(selector) {
    for (const part of selector.split(",").map((value) => value.trim()).filter(Boolean)) {
      const tag = part.match(/^([a-zA-Z][\w-]*)/)?.[1];
      if (tag && this.tagName !== tag.toUpperCase()) continue;
      let matched = true;
      for (const id of part.match(/#[-\w]+/g) ?? []) {
        if (this.getAttribute("id") !== id.slice(1)) matched = false;
      }
      for (const className of part.match(/\.[-\w]+/g) ?? []) {
        const classes = (this.getAttribute("class") ?? "").split(/\s+/);
        if (!classes.includes(className.slice(1)) && !this.classList.contains(className.slice(1))) {
          matched = false;
        }
      }
      for (const attr of part.match(/\[[^\]]+\]/g) ?? []) {
        const inner = attr.slice(1, -1);
        const equals = inner.match(/^([-\w]+)\s*=\s*"?([^"]*)"?$/);
        if (equals) {
          if (this.getAttribute(equals[1]) !== equals[2]) matched = false;
        } else if (this.getAttribute(inner) === null) {
          matched = false;
        }
      }
      if (matched) return true;
    }
    return false;
  }
  querySelector(selector) { return this.descendants().find((node) => node.matches(selector)) ?? null; }
  querySelectorAll(selector) { return this.descendants().filter((node) => node.matches(selector)); }
  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parent?.closest?.(selector) ?? null;
  }
  getBoundingClientRect() {
    return { top: 700, bottom: 744, height: 44, left: 0, right: 304, width: 304 };
  }
  get clientWidth() { return 304; }
  get scrollWidth() { return String(this.value ?? "").length * 10; }
}

function makeDom() {
  const documentElement = new ElementStub("html");
  const body = new ElementStub("body");
  documentElement.appendChild(body);
  const timers = [];
  let nextTimer = 1;
  const document = {
    documentElement,
    body,
    listeners: {},
    createElement: (tag) => new ElementStub(tag),
    getElementById: (id) => documentElement.descendants().find((node) => node.getAttribute("id") === id) ?? null,
    querySelector: (selector) => documentElement.querySelector(selector),
    querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
  };
  const window = {
    listeners: {},
    innerWidth: 390,
    innerHeight: 844,
    location: { pathname: "/pages/avatar-iscott", origin: "https://wildworks.ai" },
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
    removeEventListener() {},
    dispatchEvent(event) {
      for (const listener of this.listeners[event.type] ?? []) listener(event);
      return true;
    },
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({
      paddingLeft: "24px",
      paddingRight: "24px",
      borderLeftWidth: "1px",
      borderRightWidth: "1px",
    }),
    setTimeout: (fn, ms) => { timers.push({ id: nextTimer, fn, ms }); return nextTimer++; },
    clearTimeout: (id) => { const index = timers.findIndex((timer) => timer.id === id); if (index >= 0) timers.splice(index, 1); },
    setInterval: (fn, ms) => { timers.push({ id: nextTimer, fn, ms }); return nextTimer++; },
    clearInterval: (id) => { const index = timers.findIndex((timer) => timer.id === id); if (index >= 0) timers.splice(index, 1); },
    requestAnimationFrame: (fn) => { fn(); return 1; },
  };
  return { document, window, timers };
}

function boot(fetchImpl) {
  const dom = makeDom();
  const sandbox = {
    document: dom.document,
    window: dom.window,
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
  for (const name of ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame"]) {
    sandbox[name] = dom.window[name];
  }
  const names = Object.keys(sandbox);
  new Function(...names, scriptBody)(...names.map((name) => sandbox[name]));
  return dom;
}

const EMAIL = "retry.visitor@example.com";
const SUBMITTED_AT = "2026-08-29T18:00:00.000Z";
const lead = (overrides = {}) => ({
  sessionId: "session-failed-retry-ui",
  contactMethod: "email",
  email: EMAIL,
  phone: null,
  displayValue: EMAIL,
  ariaLabel: `email ${EMAIL}`,
  status: "ready_for_confirmation",
  consentStatus: "accepted",
  contactConfirmedAt: "2026-08-29T17:59:00.000Z",
  submittedAt: null,
  notificationOutboxId: null,
  notificationStatus: null,
  mediaCount: 0,
  ...overrides,
});
const response = (body, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body });
const open = (dom, state) => dom.window.dispatchEvent({ type: "wildworks:lead-state", detail: state });
const field = (dom) => dom.document.getElementById("wildworks-lead-value");
const button = (dom) => dom.document.getElementById("wildworks-lead-confirm");
const cardView = (dom) => dom.document.querySelector(".wildworks-lead-card")?.getAttribute("data-box-view");
const captureHidden = (dom) => dom.document.querySelector(".wildworks-lead-capture")?.getAttribute("data-hidden");
const tickVisible = (dom) => dom.document.getElementById("wildworks-lead-sent")?.getAttribute("data-visible") === "true";
const statusText = (dom) => dom.document.getElementById("wildworks-lead-status")?.textContent ?? "";

// A provider-looking "sent" string without submission truth is not success.
{
  const dom = boot(async () => response({ ok: true }));
  open(dom, lead({ notificationStatus: "sent", notificationOutboxId: "outbox-inconsistent" }));
  assert.equal(cardView(dom), "captured");
  assert.equal(captureHidden(dom), "false");
  assert.equal(tickVisible(dom), false);
  assert.equal(field(dom).readOnly, false);
  assert.equal(button(dom).hidden, false);
  assert.equal(button(dom).disabled, false);
  assert.doesNotMatch(statusText(dom), /sent to Scott/i);
}

// Submission plus provider status still lacks success when the linked owner
// outbox is missing. The value remains visible, but read-only while pending.
{
  const dom = boot(async () => response({ ok: true }));
  open(dom, lead({ status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "sent" }));
  assert.equal(cardView(dom), "submitted");
  assert.equal(captureHidden(dom), "false");
  assert.equal(field(dom).value, EMAIL);
  assert.equal(field(dom).readOnly, true);
  assert.equal(button(dom).hidden, true);
  assert.equal(tickVisible(dom), true);
  assert.doesNotMatch(dom.document.getElementById("wildworks-lead-sent")?.textContent ?? "", /sent to Scott/i);
}

// Only the complete conjunction is allowed to paint terminal success.
{
  const dom = boot(async () => response({ ok: true }));
  open(dom, lead({
    status: "submitted",
    submittedAt: SUBMITTED_AT,
    notificationOutboxId: "outbox-owner-accepted",
    notificationStatus: "sent",
  }));
  assert.equal(cardView(dom), "sent");
  assert.equal(captureHidden(dom), "true");
  assert.equal(tickVisible(dom), true);
  assert.match(dom.document.getElementById("wildworks-lead-sent")?.textContent ?? "", /sent to Scott/i);
}

// Failed and dead-letter submitted rows keep their value editable and expose a
// deliberate manual retry. A failed retry returns to the same honest state; it
// never clears the value, hides the capture, or borrows success wording.
for (const notificationStatus of ["failed", "dead_letter"]) {
  let confirmCalls = 0;
  const failedState = lead({
    status: "submitted",
    submittedAt: SUBMITTED_AT,
    notificationOutboxId: `outbox-${notificationStatus}`,
    notificationStatus,
  });
  const dom = boot(async (url) => {
    if (String(url).includes("/api/iscott/lead/confirm")) {
      confirmCalls += 1;
      return response({
        ok: notificationStatus !== "dead_letter",
        queued: notificationStatus !== "dead_letter",
        delivered: false,
        detail: `voice_email_${notificationStatus}`,
        lead: failedState,
      }, notificationStatus !== "dead_letter");
    }
    return response({ ok: true });
  });
  open(dom, failedState);

  assert.equal(cardView(dom), "failed");
  assert.equal(captureHidden(dom), "false");
  assert.equal(field(dom).value, EMAIL);
  assert.equal(field(dom).readOnly, false);
  assert.equal(field(dom).disabled, false);
  assert.equal(button(dom).hidden, false);
  assert.equal(button(dom).disabled, false);
  assert.equal(tickVisible(dom), false);
  assert.equal(
    dom.document.getElementById("wildworks-lead-confirmation")?.getAttribute("data-handoff-state"),
    "failed",
  );
  assert.match(statusText(dom), /Scott does not have this yet/i);

  await button(dom).onclick();
  assert.equal(confirmCalls, 1, `${notificationStatus} exposes one intentional retry call`);
  assert.equal(cardView(dom), "failed");
  assert.equal(captureHidden(dom), "false");
  assert.equal(field(dom).value, EMAIL);
  assert.equal(field(dom).readOnly, false);
  assert.equal(button(dom).hidden, false);
  assert.equal(button(dom).disabled, false);
  assert.equal(tickVisible(dom), false);
  assert.equal(
    dom.document.getElementById("wildworks-lead-confirmation")?.getAttribute("data-handoff-state"),
    "failed",
  );
  assert.match(statusText(dom), /Scott does not have this yet|could not finish the handoff/i);
}

// Source-shape safety: failures never enter the automatic spoken-consent path.
assert.match(routeSource, /!submitted && !delivered && !failed/);
assert.match(routeSource, /hasDeliveredTruth\(lead\)/);
assert.match(routeSource, /Boolean\(lead\?\.notificationOutboxId\)/);
assert.doesNotMatch(
  routeSource,
  /\.wildworks-lead-card\[data-box-view="submitted"\] \.wildworks-lead-capture/,
  "pending submitted rows must not be hidden by shipping CSS",
);

console.log("iScott failed-submission retry UI checks passed");
