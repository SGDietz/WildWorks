import assert from "node:assert/strict";
import test from "node:test";
import { loadPhonePersona } from "../src/persona.ts";

test("loads the reviewed phone persona as a bounded system message", () => {
  const persona = loadPhonePersona();
  assert.equal(persona.role, "system");
  assert.match(persona.content, /AI assistant for WildWorks/);
  assert.match(persona.content, /not Scott/i);
  assert.match(persona.content, /877\) 600-2474/);
  assert.match(persona.content, /must never forward any WildWorks call/i);
  assert.match(persona.content, /There is no personal-cell route/i);
  assert.match(persona.content, /business voicemail/i);
});
