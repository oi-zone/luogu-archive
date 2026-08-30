import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { canExposePaste } from "../packages/query/dist/visibility.js";

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

test("paste query gates current and historical access by current visibility", () => {
  const pasteQuery = read("../packages/query/src/paste.ts");
  assert.match(pasteQuery, /canExposePaste\(current\?\.public/);
  assert.match(pasteQuery, /eq\(schema\.PasteSnapshot\.public, true\)/);
});

test("private paste policy denies main, snapshot and entries exposure", () => {
  assert.equal(canExposePaste(false), false, "main page");
  assert.equal(canExposePaste(false, true), false, "old public snapshot");
  assert.equal(canExposePaste(false, false), false, "private snapshot");
  assert.equal(
    canExposePaste(undefined),
    false,
    "entries without current state",
  );
  assert.equal(canExposePaste(true, false), false, "private historical state");
  assert.equal(canExposePaste(true, true), true);
});

test("judgement resolves one latest snapshot per page user in PostgreSQL", () => {
  const judgement = read("../packages/query/src/judgement.ts");
  assert.match(judgement, /SELECT DISTINCT ON \("userId"\)/);
  assert.match(judgement, /ORDER BY "userId", "capturedAt" DESC/);
  assert.equal(judgement.includes("snapshotMap.has"), false);
});
