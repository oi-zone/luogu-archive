import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  canExposeEntity,
  canExposeSnapshot,
} from "../packages/query/dist/visibility.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public web has no queue-producing Server Action", () => {
  assert.equal(
    existsSync(
      new URL("../apps/web/server-actions/queue-jobs.ts", import.meta.url),
    ),
    false,
  );
  assert.equal(
    read("../apps/web/package.json").includes(
      '"@luogu-discussion-archive/queue"',
    ),
    false,
  );
});

test("crawler public clients never read privileged cookies", () => {
  const client = read("../packages/crawler/src/client.ts");
  assert.equal(
    client.includes("LUOGU_COOKIE"),
    true,
    "comment documents removal",
  );
  assert.equal(client.includes("process.env.LUOGU_COOKIE"), false);
  assert.equal(client.includes("cookie:"), false);
});

test("manual BullMQ rate limiting has no processor sleep", () => {
  const worker = read("../apps/worker/src/worker.ts");
  assert.match(worker, /worker\.rateLimit\(/);
  assert.match(worker, /Worker\.RateLimitError\(\)/);
  assert.equal(worker.includes("setTimeout"), false);
});

test("cursor table enforces one chain per entity key", () => {
  const migration = read(
    "../packages/database/prisma/migrations/20260830090000_crawl_cursor/migration.sql",
  );
  assert.match(migration, /PRIMARY KEY \("entityType", "entityId"\)/);
  assert.equal(migration.includes("TTL"), false);
});

test("entity and snapshot provenance fail closed", () => {
  const now = new Date();
  const entity = {
    visibilityState: "public",
    visibilityCheckedAt: now,
    visibilitySource: "anonymous_upstream",
  };
  const snapshot = {
    exposureState: "public",
    verifiedPublicAt: now,
    verifiedSource: "anonymous_upstream",
  };
  assert.equal(canExposeEntity("public", now, "anonymous_upstream", now), true);
  assert.equal(canExposeSnapshot(entity, snapshot, now), true);
  assert.equal(
    canExposeSnapshot(
      entity,
      { ...snapshot, exposureState: "unverified" },
      now,
    ),
    false,
  );
  assert.equal(
    canExposeSnapshot(
      { ...entity, visibilityState: "restricted" },
      snapshot,
      now,
    ),
    false,
  );
  assert.equal(
    canExposeSnapshot({ ...entity, visibilitySource: "legacy" }, snapshot, now),
    false,
  );
});

test("judgement resolves one latest snapshot per page user in PostgreSQL", () => {
  const judgement = read("../packages/query/src/judgement.ts");
  assert.match(judgement, /SELECT DISTINCT ON \("userId"\)/);
  assert.match(judgement, /ORDER BY "userId", "capturedAt" DESC/);
  assert.equal(judgement.includes("snapshotMap.has"), false);
});
