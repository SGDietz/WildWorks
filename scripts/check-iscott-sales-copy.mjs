import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sales = await readFile(path.join(root, "src/lib/iscottSalesCopy.ts"), "utf8");
const parsing = await readFile(path.join(root, "src/lib/iscottLeadParsing.ts"), "utf8");
assert.match(sales, /fully furnished AI-driven website to sell your brand/);
assert.match(sales, /knows his work, deeply/);
assert.match(sales, /This WildWorks site is his/);
assert.doesNotMatch(sales, /40 years/);
assert.match(parsing, /iscottSalesCopyContextBlock/);
assert.match(parsing, /I'm sending that to Scott/);
console.log("iScott approved sales-copy checks passed.");
