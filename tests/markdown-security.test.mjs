import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKDOWN_SECURITY_LIMITS,
  parseHighlightRanges,
  utf8ByteLengthExceeds,
} from "../packages/remark-lda-lfm/security-limits.js";

test("hostile highlight ranges are rejected without expansion", () => {
  assert.deepEqual(parseHighlightRanges("1-1000000000", 100), []);
  assert.deepEqual(parseHighlightRanges("999999999999999999999", 100), []);
  assert.deepEqual(
    parseHighlightRanges(
      Array.from({ length: 1_000 }, (_, index) => String(index + 1)).join(","),
      2_000,
    ),
    [],
  );
});

test("valid ranges are intersected, normalized and merged", () => {
  assert.deepEqual(parseHighlightRanges("1-3,2-5,100-200", 120), [
    { start: 1, end: 5 },
    { start: 100, end: 120 },
  ]);
  assert.ok(MARKDOWN_SECURITY_LIMITS.maxHighlightedLines <= 1_000);
});

test("document byte guard does not allocate a duplicate giant buffer", () => {
  assert.equal(
    utf8ByteLengthExceeds(
      "界".repeat(MARKDOWN_SECURITY_LIMITS.maxDocumentBytes),
      MARKDOWN_SECURITY_LIMITS.maxDocumentBytes,
    ),
    true,
  );
});
