import assert from "node:assert/strict";
import test from "node:test";

import { HttpError } from "../packages/crawler/dist/error.js";
import { parseRetryAfter, requestJson } from "../packages/crawler/dist/http.js";

test("HttpError stores bounded metadata and never retains Response", () => {
  const error = new HttpError(
    "https://example.invalid",
    429,
    1_000,
    "http_status",
  );
  assert.equal("response" in error, false);
  assert.equal(error.retryAfterMs, 1_000);
});

test("non-success HTTP bodies are cancelled", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("private response body"));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(
    requestJson(
      async () =>
        new Response(stream, {
          status: 429,
          headers: { "retry-after": "999999999" },
        }),
      {
        endpoint: "test",
        timeoutMs: 1_000,
        maxBytes: 1_024,
        validate: (value) => value,
      },
    ),
    HttpError,
  );
  assert.equal(cancelled, true);
});

test("Retry-After is parsed and clamped", () => {
  assert.equal(parseRetryAfter("0"), 1_000);
  assert.equal(parseRetryAfter("999999999"), 15 * 60 * 1_000);
  assert.equal(parseRetryAfter("not-a-date"), null);
});

test("malformed 429 Retry-After still receives the minimum limiter delay", async () => {
  await assert.rejects(
    requestJson(
      async () =>
        new Response(null, {
          status: 429,
          headers: { "retry-after": "invalid" },
        }),
      {
        endpoint: "test",
        timeoutMs: 1_000,
        maxBytes: 1_024,
        validate: (value) => value,
      },
    ),
    (error) => error instanceof HttpError && error.retryAfterMs === 1_000,
  );
});
