// Local-only geometry proof for the lead card and the in-avatar Finish control.
// It executes the shipping refreshLeadPosition function against deterministic
// viewport/DOM fixtures. No browser, provider, network, or backend is involved.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const routeSource = await fs.readFile("app/pages/avatar-iscott/route.ts", "utf8");
const finishCoverRule = routeSource.match(
  /html:has\(#wildworks-lead-confirmation\.wildworks-lead-visible\)\s+\[data-ww-finish\]\s*\{([^}]*)\}/,
);
assert.ok(finishCoverRule, "a visible lead card must suppress Finish completely");
assert.match(finishCoverRule[1], /visibility:\s*hidden\s*!important/, "Finish must not paint behind a visible card");
assert.match(finishCoverRule[1], /pointer-events:\s*none\s*!important/, "Finish must not accept taps behind a visible card");
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
  "geometryLoggedForSession",
  `${positionSource[0]}; return refreshLeadPosition;`,
);

const viewports = [
  { name: "desktop", width: 1440, height: 900, finishTop: 740 },
  { name: "tablet", width: 768, height: 1024, finishTop: 872 },
  { name: "iPad measured embed", width: 820, height: 1180, finishTop: 1014 },
  // Exact 2026-09-02 physical ride geometry: Safari exposes a 511px inner
  // height but resolves fixed positioning against a 587px box. The card is
  // 73px high and must retain its intentional Finish overlap without falling
  // below the 511px visible frame. CSS suppresses Finish for that whole period.
  { name: "iPad expanded fixed box", width: 287, height: 511, fixedBoxHeight: 587, measured: true, finishTop: 440.8, finishHeight: 58.2, cardHeight: 73 },
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
    const panelClasses = new Set();
    const panel = {
      style: {
        removeProperty(name) { delete styleValues[name]; },
        setProperty(name, value) { styleValues[name] = String(value); },
      },
      classList: {
        add(name) { panelClasses.add(name); },
        remove(name) { panelClasses.delete(name); },
        contains(name) { return panelClasses.has(name); },
      },
      setAttribute(name, value) { attributes[name] = String(value); },
    };
    const finish = {
      textContent: "Finish",
      getBoundingClientRect: () => ({
        left: viewport.width / 2 - 70,
        right: viewport.width / 2 + 70,
        top: viewport.finishTop,
        bottom: viewport.finishTop + (viewport.finishHeight ?? 44),
        width: 140,
        height: viewport.finishHeight ?? 44,
      }),
    };
    const card = { getAttribute: (name) => name === "data-box-view" ? state : null };
    // CLAUDE 2026-09-01: the positioner measures the card via panel.querySelector
    // (the cardH * 0.7 overlap G asked for), not document.querySelector. The fake
    // only answered on document, so this guard crashed instead of testing.
    panel.querySelector = (selector) => selector === ".wildworks-lead-card" ? card : null;
    // 96 was invented. The capture card is pinned to 4.6rem and measures 73.6px
    // on every ride since H472 (iscott_embed_geometry card.height 73.59/73.6).
    const measuredCardHeight = viewport.cardHeight ?? 73.6;
    card.getBoundingClientRect = () => ({ height: measuredCardHeight, top: 0, bottom: measuredCardHeight, width: 300 });
    const field = {};
    const document = {
      documentElement: {
        hasAttribute(name) { return name === "data-ww-embed-measured" && viewport.measured === true; },
      },
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
      "finish-clearance",
    );

    refreshLeadPosition();

    const expandedBy = (viewport.fixedBoxHeight ?? viewport.height) - viewport.height;
    const bottomText = styleValues.bottom;
    const calcLift = /\+\s*([0-9.]+)px\)/.exec(bottomText)?.[1];
    const bottomOffset = bottomText.startsWith("calc(")
      ? expandedBy + Number.parseFloat(calcLift)
      : Number.parseFloat(bottomText);
    assert.ok(Number.isFinite(bottomOffset), `${viewport.name}/${state} sets measured bottom`);
    const panelBottom = (viewport.fixedBoxHeight ?? viewport.height) - bottomOffset;
    const gap = viewport.finishTop - panelBottom;
    // CLAUDE 2026-09-01. This guard used to demand >= 8px of CLEARANCE above
    // Finish. G replaced that rule in his 14:06 ride and asked for overlap.
    //   "this box should be 70% of the height should be over the finish box"
    //   "That should be over the finish box, and then that should go away."
    //   "Everything, just put it over the finish box. It is gorgeous."
    // The positioner implements it as cardH * 0.7, so the card now OVERLAPS
    // Finish on purpose and a clearance assertion can only ever fail.
    // The later phone ride superseded the old "leave some Finish visible" rule:
    // Finish is now fully suppressed while the card is visible. Geometry still
    // keeps the card in the accepted footprint and catches one that floats away.
    const cardHeight = measuredCardHeight;
    const overlap = -gap;
    assert.ok(overlap > cardHeight * 0.5,
      `${viewport.name}/${state} must sit OVER Finish, ~70% of the card (overlap ${overlap} of ${cardHeight})`);
    if (viewport.measured) {
      assert.match(bottomText, /^calc\(100dvh - var\(--ww-embed-h\) \+ [0-9]+px\)$/,
        `${viewport.name}/${state} compensates for Safari's expanded fixed box`);
      assert.ok(panelBottom <= finish.getBoundingClientRect().bottom,
        `${viewport.name}/${state} card bottom stays within Finish and the visible frame`);
      assert.ok(panelBottom <= viewport.height,
        `${viewport.name}/${state} card does not clip below the ${viewport.height}px visible frame`);
    }

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
    const finishSuppressed = () => panel.classList.contains("wildworks-lead-visible");
    const elementFromPoint = (x, y) => {
      // Shipping order: lead panel z60, Finish z45. The :has() rule additionally
      // makes all of Finish invisible/inert while the panel class is present.
      if (attributes["aria-hidden"] !== "true" && contains(panelRect, x, y)) return panel;
      if (finishSuppressed()) return null;
      if (contains(finishRect, x, y)) return finish;
      return null;
    };
    // While the capture/confirmation card is intentionally over Finish, the
    // card owns that hit area. Once verified delivery hides the whole panel at
    // the two-second boundary, Finish owns the exact same point again. Testing
    // both states reflects the requested lifecycle instead of demanding that a
    // covered control receive a click through the card.
    const hit = elementFromPoint(viewport.width / 2, viewport.finishTop + 22);
    assert.equal(hit, panel, `${viewport.name}/${state} lets the visible lead card own the overlap`);
    assert.equal(attributes["aria-hidden"], "false", `${viewport.name}/${state} remains visible before dismissal`);
    assert.equal(finishSuppressed(), true, `${viewport.name}/${state} suppresses all of Finish while the card is visible`);
    assert.notEqual(
      elementFromPoint(viewport.width / 2, finishRect.bottom - 1),
      finish,
      `${viewport.name}/${state} leaves no visible or interactive Finish sliver below the card`,
    );
    panel.classList.remove("wildworks-lead-visible");
    panel.setAttribute("aria-hidden", "true");
    const hitAfterPanelDismissal = elementFromPoint(viewport.width / 2, viewport.finishTop + 22);
    assert.equal(hitAfterPanelDismissal, finish, `${viewport.name}/${state} restores Finish after dismissal`);
    assert.equal(finishSuppressed(), false, `${viewport.name}/${state} removes only the card-gated Finish suppression`);
    assert.equal(attributes["aria-hidden"], "true", `${viewport.name}/${state} is hidden after dismissal`);
  }
}

// 2026-09-03: the positioner no longer keeps 8px of CLEARANCE above Finish.
// Since H435 (G 09-03 09:02, "Your email is just too high... it needs to be
// where it sits when the email address is on the screen") the card sits a
// CONSTANT 51px over Finish in every state - the GOLD-locked box. These two
// lines used to assert the retired constant and went red on their own.
// 51 -> 49 on 2026-09-03 10:5x: Finish stopped stretching after a capture, so
// the filled-state edge G pointed at needs 2px less overlap from its (now
// lower) top.
// 49 -> 44 on 2026-09-03 12:1x: Finish lost 5px of padding (ride 84155e82),
// so the same card edge needs 5px less overlap from its lower top.
assert.match(positionSource[0], /const FILLED_OVERLAP_PX = 44/);
assert.match(positionSource[0], /Math\.ceil\(window\.innerHeight - rect\.top - FILLED_OVERLAP_PX\)/);
assert.doesNotMatch(positionSource[0], /FINISH_CLEARANCE_PX/, "the retired clearance constant must not come back");
assert.match(positionSource[0], /calc\(100dvh - var\(--ww-embed-h\) \+ /);
assert.match(routeSource, /fixedBoxBottom/);
assert.doesNotMatch(positionSource[0], /rect\.bottom|OVERHANG_PX|settled/);
assert.match(
  routeSource,
  /@keyframes wildworks-lead-rise \{\s*\/\*[^]*?from \{[^}]*translateX\(-50%\)[^}]*\}/,
  "entrance animation must not move the card down through the Finish gap",
);

console.log("iScott Finish cover/restore checks passed across desktop, tablet/iPad, 375px, and 390px.");
