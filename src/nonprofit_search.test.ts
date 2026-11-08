import assert from "node:assert/strict";
import { chooseRecord } from "./nonprofit_search";

const result = chooseRecord("Where is my donor receipt?");
assert.equal(result.id, "receipt-2026-001");
assert.equal(result.kind, "receipt");
console.log("nonprofit search decision: receipt query selects receipt content");
