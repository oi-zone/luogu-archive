import assert from "node:assert/strict";
import test from "node:test";

import { runShutdownSequence } from "../apps/worker/dist/shutdown.js";
import {
  COMPLETED_RETENTION,
  DEFAULT_JOB_OPTIONS,
  FAILED_RETENTION,
  runnablePressureDepth,
} from "../packages/queue/dist/config.js";

test("completed and failed job retention have age and count bounds", () => {
  assert.ok(COMPLETED_RETENTION.age > 0);
  assert.ok(COMPLETED_RETENTION.count > 0);
  assert.ok(FAILED_RETENTION.age > 0);
  assert.ok(FAILED_RETENTION.count > 0);
  assert.ok(DEFAULT_JOB_OPTIONS.attempts >= 1);
  assert.equal(DEFAULT_JOB_OPTIONS.backoff.type, "exponential");
  assert.ok(DEFAULT_JOB_OPTIONS.backoff.jitter > 0);
});

test("failed and completed retention do not count as runnable pressure", () => {
  assert.equal(
    runnablePressureDepth({
      wait: 1,
      active: 2,
      delayed: 3,
      prioritized: 4,
      failed: 5_000,
      completed: 10_000,
    }),
    10,
  );
});

test("shutdown closes resources in the required order", async () => {
  const order = [];
  const step = (name) => async () => order.push(name);
  await runShutdownSequence({
    stopAccepting: step("stop"),
    closeWorkers: step("workers"),
    closeQueues: step("queues"),
    closeRedis: step("redis"),
    closeLogger: step("logger"),
    closeSentry: step("sentry"),
    closeDatabase: step("database"),
  });
  assert.deepEqual(order, [
    "stop",
    "workers",
    "queues",
    "redis",
    "logger",
    "sentry",
    "database",
  ]);
});

test("shutdown attempts later resources after an earlier close failure", async () => {
  const order = [];
  const step = (name) => async () => order.push(name);
  await assert.rejects(
    runShutdownSequence({
      stopAccepting: step("stop"),
      closeWorkers: async () => {
        order.push("workers");
        throw new Error("worker close failed");
      },
      closeQueues: step("queues"),
      closeRedis: step("redis"),
      closeLogger: step("logger"),
      closeSentry: step("sentry"),
      closeDatabase: step("database"),
    }),
    AggregateError,
  );
  assert.deepEqual(order, [
    "stop",
    "workers",
    "queues",
    "redis",
    "logger",
    "sentry",
    "database",
  ]);
});
