import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ENTRY_INPUT_BYTES,
  MAX_ENTRY_REFS,
  parseEntryRef,
  uniqueEntryRefs,
  validateEntryRequest,
} from "../packages/query/dist/entry-validation.js";

test("entry refs use type-specific strict runtime validation", () => {
  assert.deepEqual(parseEntryRef("user:123"), { type: "user", id: "123" });
  assert.deepEqual(parseEntryRef("article:abcd1234"), {
    type: "article",
    id: "abcd1234",
  });
  for (const invalid of [
    "user:NaN",
    "user:Infinity",
    "user:9999999999",
    "user:",
    "user:1:2",
    "user:１２３",
    "paste:abc",
    "article:ABCDEFGH",
    "unknown:1",
  ]) {
    assert.equal(parseEntryRef(invalid), null, invalid);
  }
  assert.equal(MAX_ENTRY_REFS, 100);
  assert.equal(MAX_ENTRY_INPUT_BYTES, 16 * 1024);
});

test("entry request count and byte limits return stable HTTP status contracts", () => {
  assert.deepEqual(
    validateEntryRequest(["user:1"], MAX_ENTRY_INPUT_BYTES + 1),
    { ok: false, status: 413, error: "Request too large" },
  );
  assert.deepEqual(
    validateEntryRequest(
      Array.from({ length: 101 }, () => "user:1"),
      1_000,
    ),
    { ok: false, status: 400, error: "Too many entry refs" },
  );
});

test("entry refs are deduplicated before database work without reordering", () => {
  const refs = [
    parseEntryRef("user:1"),
    parseEntryRef("paste:abcd1234"),
    parseEntryRef("user:1"),
  ].filter(Boolean);
  assert.deepEqual(uniqueEntryRefs(refs), refs.slice(0, 2));
});
