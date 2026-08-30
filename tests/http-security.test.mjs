import assert from "node:assert/strict";
import test from "node:test";

import { PublicRequestClient } from "../packages/crawler/dist/client.js";
import {
  HttpError,
  UpstreamPayloadError,
} from "../packages/crawler/dist/error.js";
import { parseRetryAfter, requestJson } from "../packages/crawler/dist/http.js";
import { validateArticleDetails } from "../packages/crawler/dist/payload-validation.js";

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

test("route config cannot redirect a public client across origins", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(
      JSON.stringify({
        route: { "article.show": "https://evil.invalid/{lid}" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const client = new PublicRequestClient({
      baseUrl: "https://origin.invalid",
      headers: {},
    });
    await assert.rejects(
      client.getJson(
        "article.show",
        { params: { lid: "abc12345" } },
        {
          endpoint: "article.show",
          timeoutMs: 1_000,
          maxBytes: 1_024,
          validate: (value) => value,
        },
      ),
      UpstreamPayloadError,
    );
    assert.equal(requests, 1, "only the same-origin config request is sent");
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("nested upstream fields are validated before database writes", () => {
  const article = {
    lid: "abc12345",
    title: "x".repeat(513),
    time: 1_700_000_000,
    author: {
      uid: 1,
      name: "user",
      slogan: "",
      badge: null,
      isAdmin: false,
      isBanned: false,
      isRoot: false,
      color: "Blue",
      ccfLevel: 0,
      xcpcLevel: 0,
      background: "",
    },
    upvote: 0,
    replyCount: 0,
    favorCount: 0,
    status: 2,
    category: 1,
    solutionFor: null,
    promoteStatus: 0,
    collection: null,
    content: "body",
    adminNote: null,
  };
  assert.throws(() => validateArticleDetails(article, "article.test"));
  assert.throws(() =>
    validateArticleDetails(
      { ...article, title: "ok", author: { ...article.author, uid: 0 } },
      "article.test",
    ),
  );
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
