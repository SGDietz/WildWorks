import { strict as assert } from "node:assert";
import { apparentInterest, easternDateStamp } from "../src/lib/voiceEmailNotifications";

assert.equal(apparentInterest("I need a stone patio and drainage help."), "Landscaping");
assert.equal(apparentInterest("I want a new website and brand."), "Website");
assert.equal(apparentInterest("I need a garden and a website refresh."), "Landscaping and Website");
assert.equal(apparentInterest("Can you help with a custom project?"), "WildWorks Project");
assert.equal(easternDateStamp("2026-08-17T03:30:00.000Z"), "20260816");
assert.equal(easternDateStamp("2026-08-17T04:30:00.000Z"), "20260817");

console.log("VIP iScott notification checks OK.");
