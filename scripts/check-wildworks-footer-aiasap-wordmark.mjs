import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const footer = readFileSync(new URL("../app/components/Footer.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const footerColorAuthority = readFileSync(
  new URL("../app/H108-footer-legal-links-color-one.css", import.meta.url),
  "utf8",
);

assert.equal(
  (footer.match(/wild-footer-aiasap-wordmark/g) ?? []).length,
  1,
  "the footer must contain exactly one scoped aiASAP wordmark",
);
assert.match(
  footer,
  /\{"Discover What’s Possible With "\}\s*<span className="wild-footer-aiasap-wordmark">aiASAP<\/span>/,
  "the exact footer line must be preserved while wrapping only aiASAP",
);
assert.match(
  footer,
  /className="wild-footer-aiasap-link"[\s\S]{0,180}href="https:\/\/aiasap\.ai\/"/,
  "the existing destination must remain unchanged",
);
assert.match(
  globals,
  /#footer \.wild-footer-aiasap-link \.wild-footer-aiasap-wordmark\s*\{\s*color:\s*inherit !important;\s*-webkit-text-fill-color:\s*inherit !important;\s*font-style:\s*italic;\s*\}/,
  "only the scoped footer wordmark should receive italic styling",
);
assert.doesNotMatch(globals, /(?:^|\n)\s*(?:aiASAP|\.aiasap|\[.*aiasap.*\])\s*\{[^}]*font-style:\s*italic/is);
assert.match(
  footerColorAuthority,
  /\.wild-footer-closing > span \*:not\(\.wild-footer-aiasap-wordmark\)/,
  "the existing broad descendant color rule must not recolor the scoped wordmark",
);

console.log("WildWorks footer aiASAP wordmark check passed.");
