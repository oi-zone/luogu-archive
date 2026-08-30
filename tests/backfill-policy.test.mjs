import assert from "node:assert/strict";
import test from "node:test";

import {
  articleRepliesNextCursor,
  discussionNextCursor,
  planCursorRefresh,
  progressingCursor,
} from "../apps/worker/dist/backfill-policy.js";

test("completed 100-page discussion refreshes stay O(1)", () => {
  let cursor = { status: "completed", nextCursor: null, version: 1 };
  let enqueued = 0;
  for (let index = 0; index < 100; index += 1) {
    const plan = planCursorRefresh(cursor, "99");
    cursor = plan.cursor;
    if (plan.enqueue) enqueued += 1;
  }
  assert.equal(enqueued, 0);
  assert.deepEqual(cursor, {
    status: "completed",
    nextCursor: null,
    version: 1,
  });
});

test("pending cursor resumes after restart without resetting its version", () => {
  const pending = { status: "pending", nextCursor: "42", version: 7 };
  const resumed = planCursorRefresh(pending, "99");
  assert.equal(resumed.enqueue, true);
  assert.strictEqual(resumed.cursor, pending);
});

test("deduplication does not depend on a one-hour TTL", () => {
  const completed = { status: "completed", nextCursor: null, version: 3 };
  const afterArbitraryDelay = planCursorRefresh(completed, "99", false);
  assert.equal(afterArbitraryDelay.enqueue, false);
  assert.equal(afterArbitraryDelay.cursor.version, 3);
});

test("backfill stops at archived overlap and explicit safety boundary", () => {
  assert.equal(progressingCursor("42", "42"), null);
  assert.equal(progressingCursor("42", "41"), "41");
  assert.deepEqual(
    discussionNextCursor({
      page: 99,
      numReplies: 10,
      numNewReplies: 0,
      pagesProcessed: 0,
      maximumPages: 1_000,
    }),
    { state: "completed" },
  );
  assert.deepEqual(
    discussionNextCursor({
      page: 99,
      numReplies: 10,
      numNewReplies: 10,
      pagesProcessed: 999,
      maximumPages: 1_000,
    }),
    { state: "paused", nextCursor: "98", reason: "page_limit" },
  );
  assert.deepEqual(
    articleRepliesNextCursor({
      lastReplyId: 123,
      lastReplySaved: true,
      replyCount: 20,
      newReplyCount: 10,
      pagesProcessed: 0,
      maximumPages: 1_000,
    }),
    { state: "completed" },
  );
});

test("explicit reopen increments the chain version exactly once", () => {
  const completed = { status: "completed", nextCursor: null, version: 2 };
  const reopened = planCursorRefresh(completed, "99", true);
  assert.equal(reopened.enqueue, true);
  assert.deepEqual(reopened.cursor, {
    status: "pending",
    nextCursor: "99",
    version: 3,
  });
  const duplicate = planCursorRefresh(reopened.cursor, "99", true);
  assert.strictEqual(duplicate.cursor, reopened.cursor);
  assert.equal(duplicate.cursor.version, 3);
});
