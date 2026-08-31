// Local-only geometry proof for the lead card and the in-avatar Finish control.
// It executes the shipping refreshLeadPosition function against deterministic
// viewport/DOM fixtures. No browser, provider, network, or backend is involved.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const routeSource = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");
const positionSource = routeSource.match(
  /const refreshLeadPosition = \(\) => \{[\s\S]*?\n      \};/,
);
assert.ok(positionSource, "shipping lead-position function must remain extractable");

const buildPositioner = new Function(
  "document",
  "window",
  "activeLead",
  "dismissed",
  "revealingContact",
  "fitValueText",
  `${positionSource[0]}; return refreshLeadPosition;`,
);

const viewports = [
  { name: "desktop", width: 1440, height: 900, finishTop: 740 },
  { name: "tablet", width: 768, height: 1024, finishTop: 872 },
  { name: "iPad measured embed", width: 820, height: 1180, finishTop: 1014 },
  { name: "375px phone", width: 375, height: 812, finishTop: 659 },
  { name: "390px phone", width: 390, height: 844, finishTop: 692 },
];
const states = ["captured", "sending", "failed", "submitted", "sent"];
const cardHeights = {
  captured: 146,
  sending: 146,
  failed: 184,
  submitted: 164,
  sent: 72,
};

for (const viewport of viewports) {
  for (const state of states) {
    const attributes = { "aria-hidden": "true" };
    const styleValues = {};
    const panel = {
      style: {
        removeProperty(name) { delete styleValues[name]; },
        setProperty(name, value) { styleValues[name] = String(value); },
      },
      classList: { add() {} },
      setAttribute(name, value) { attributes[name] = String(value); },
    };
    const finish = {
      textContent: "Finish",
      getBoundingClientRect: () => ({
        left: viewport.width / 2 - 70,
        right: viewport.width / 2 + 70,
        top: viewport.finishTop,
        bottom: viewport.finishTop + 44,
        width: 140,
        height: 44,
      }),
    };
    const card = { getAttribute: (name) => name === "data-box-view" ? state : null };
    const field = {};
    const document = {
      getElementById(id) {
        if (id === "wildworks-lead-confirmation") return panel;
        if (id === "wildworks-lead-value") return field;
        return null;
      },
      querySelector(selector) {
        if (selector === "[data-ww-finish]") return finish;
        if (selector === ".wildworks-lead-card") return card;
        return null;
      },
      querySelectorAll: (selector) => selector === "button" ? [finish] : [],
    };
    const window = { innerHeight: viewport.height };
    const refreshLeadPosition = buildPositioner(
      document,
      window,
      { sessionId: "finish-clearance" },
      false,
      true,
      () => {},
    );

    refreshLeadPosition();

    const bottomOffset = Number.parseFloat(styleValues.bottom);
    assert.ok(Number.isFinite(bottomOffset), `${viewport.name}/${state} sets measured bottom`);
    const panelBottom = viewport.height - bottomOffset;
    const gap = viewport.finishTop - panelBottom;
    assert.ok(gap >= 8, `${viewport.name}/${state} keeps at least 8px above Finish (got ${gap})`);

    const panelWidth = Math.min(viewport.width - 12, 304);
    const panelRect = {
      left: viewport.width / 2 - panelWidth / 2,
      right: viewport.width / 2 + panelWidth / 2,
      top: panelBottom - cardHeights[state],
      bottom: panelBottom,
    };
    const finishRect = finish.getBoundingClientRect();
    const contains = (rect, x, y) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    const elementFromPoint = (x, y) => {
      // Shipping order: lead panel z60, Finish z45. Geometry must therefore
      // keep the higher panel completely out of the Finish hit target.
      if (contains(panelRect, x, y)) return panel;
      if (contains(finishRect, x, y)) return finish;
      return null;
    };
    const hit = elementFromPoint(viewport.width / 2, viewport.finishTop + 22);
    assert.equal(hit, finish, `${viewport.name}/${state} resolves Finish at its center point`);
    assert.equal(attributes["aria-hidden"], "false", `${viewport.name}/${state} remains visible`);
  }
}

assert.match(positionSource[0], /const FINISH_CLEARANCE_PX = 8/);
assert.match(positionSource[0], /Math\.ceil\(window\.innerHeight - rect\.top \+ FINISH_CLEARANCE_PX\)/);
assert.doesNotMatch(positionSource[0], /rect\.bottom|OVERHANG_PX|settled/);
assert.match(
  routeSource,
  /@keyframes wildworks-lead-rise \{\s*\/\*[^]*?from \{[^}]*translateX\(-50%\)[^}]*\}/,
  "entrance animation must not move the card down through the Finish gap",
);

console.log("iScott Finish clearance checks passed across desktop, tablet/iPad, 375px, and 390px.");
