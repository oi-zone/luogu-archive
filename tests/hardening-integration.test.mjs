import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const enabled = process.env.HARDENING_INTEGRATION === "1";
const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function waitFor(predicate, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${message}`);
}

test(
  "PostgreSQL and Redis hardening integration",
  { skip: !enabled },
  async (t) => {
    const dbModule =
      await import("../apps/worker/node_modules/@luogu-discussion-archive/db/dist/drizzle.js");
    const query = await import("../packages/query/dist/index.js");
    const queue =
      await import("../apps/worker/node_modules/@luogu-discussion-archive/queue/dist/index.js");
    const backfill = await import("../apps/worker/dist/backfill.js");
    const policy = await import("../apps/worker/dist/backfill-policy.js");
    const visibility = await import("../apps/worker/dist/visibility.js");
    const crawler = await import("../packages/crawler/dist/index.js");
    const logging =
      await import("../apps/worker/node_modules/@luogu-discussion-archive/logging/dist/index.js");
    const bullmq =
      await import("../packages/queue/node_modules/bullmq/dist/cjs/index.js");
    const pgModule =
      await import("../packages/database/node_modules/pg/lib/index.js");
    const { Client } = pgModule.default;
    const { db, sql, schema, closeDb } = dbModule;

    async function cleanQueues() {
      for (const target of [queue.refreshQueue, queue.backfillQueue]) {
        await target.obliterate({ force: true }).catch(() => undefined);
      }
    }

    async function resetData() {
      await db.execute(sql`
        TRUNCATE TABLE
          "BackfillResumeState",
          "VisibilityScanState",
          "CrawlCursor",
          "User",
          "Forum",
          "Problem",
          "Article",
          "Post",
          "Paste"
        CASCADE
      `);
      await cleanQueues();
    }

    async function seedPublicDependencies() {
      await db.execute(sql`
        INSERT INTO "User" ("id") VALUES (1) ON CONFLICT DO NOTHING;
        INSERT INTO "UserSnapshot" (
          "userId", "name", "slogan", "badge", "isAdmin", "isBanned",
          "isRoot", "color", "ccfLevel", "xcpcLevel", "background",
          "capturedAt", "lastSeenAt"
        ) VALUES (
          1, 'tester', '', NULL, FALSE, FALSE, FALSE, 'Blue', 0, 0, '',
          NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
        INSERT INTO "Forum" ("name", "type", "slug", "color", "problemId", "updatedAt")
        VALUES ('Forum', NULL, 'test-forum', NULL, NULL, NOW())
        ON CONFLICT DO NOTHING;
      `);
    }

    try {
      await t.test(
        "corrective migration makes legacy bodies unverified",
        async () => {
          const sourceUrl = new URL(process.env.DATABASE_URL);
          const databaseName = `luogu_archive_migration_${process.pid.toString()}_${Date.now().toString(36)}`;
          assert.match(databaseName, /^[a-z0-9_]+$/);
          const adminUrl = new URL(sourceUrl);
          adminUrl.pathname = "/postgres";
          const tempUrl = new URL(sourceUrl);
          tempUrl.pathname = `/${databaseName}`;
          const admin = new Client({ connectionString: adminUrl.toString() });
          await admin.connect();
          await admin.query(`CREATE DATABASE "${databaseName}"`);
          const temporary = new Client({
            connectionString: tempUrl.toString(),
          });
          try {
            await temporary.connect();
            const migrationsRoot = path.join(
              root,
              "packages/database/prisma/migrations",
            );
            const names = (
              await readdir(migrationsRoot, { withFileTypes: true })
            )
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .sort();
            for (const name of names) {
              if (name === "20260830120000_fail_closed_visibility") break;
              const migration = await readFile(
                path.join(migrationsRoot, name, "migration.sql"),
                "utf8",
              );
              await temporary.query(migration);
            }

            await temporary.query(`
          INSERT INTO "User" ("id") VALUES (1);
          INSERT INTO "UserSnapshot" (
            "userId", "name", "slogan", "badge", "isAdmin", "isBanned",
            "isRoot", "color", "ccfLevel", "xcpcLevel", "background",
            "capturedAt", "lastSeenAt"
          ) VALUES (1, 'legacy', '', NULL, FALSE, FALSE, FALSE, 'Blue', 0, 0, '', NOW(), NOW());
          INSERT INTO "Forum" ("name", "type", "slug", "color", "problemId", "updatedAt")
          VALUES ('legacy', NULL, 'legacy', NULL, NULL, NOW());
          INSERT INTO "Post" ("id", "time", "replyCount", "public", "updatedAt")
          VALUES (1, NOW(), 1, TRUE, NOW());
          INSERT INTO "PostSnapshot" (
            "postId", "title", "authorId", "forumSlug", "topped", "locked",
            "content", "pinnedReplyId", "capturedAt", "lastSeenAt"
          ) VALUES (1, 'legacy', 1, 'legacy', FALSE, FALSE, 'secret-post', NULL, NOW(), NOW());
          INSERT INTO "Reply" ("id", "postId", "authorId", "time") VALUES (1, 1, 1, NOW());
          INSERT INTO "ReplySnapshot" ("replyId", "content", "capturedAt", "lastSeenAt")
          VALUES (1, 'secret-reply', NOW(), NOW());
          INSERT INTO "Article" (
            "lid", "time", "authorId", "upvote", "replyCount", "favorCount", "public", "updatedAt"
          ) VALUES ('abc12345', NOW(), 1, 0, 1, 0, TRUE, NOW());
          INSERT INTO "ArticleSnapshot" (
            "articleId", "title", "category", "status", "solutionForPid",
            "promoteStatus", "collectionId", "content", "adminNote", "capturedAt", "lastSeenAt"
          ) VALUES ('abc12345', 'legacy', 1, 2, NULL, 0, NULL, 'secret-article', NULL, NOW(), NOW());
          INSERT INTO "ArticleReply" (
            "id", "articleId", "authorId", "time", "content", "updatedAt"
          ) VALUES (2, 'abc12345', 1, NOW(), 'secret-comment', NOW());
        `);

            const correction = await readFile(
              path.join(
                migrationsRoot,
                "20260830120000_fail_closed_visibility",
                "migration.sql",
              ),
              "utf8",
            );
            await temporary.query(correction);
            const result = await temporary.query(`
          SELECT
            (SELECT "public" FROM "Post" WHERE "id" = 1) AS "postPublic",
            (SELECT "visibilityState" FROM "Post" WHERE "id" = 1) AS "postState",
            (SELECT "exposureState" FROM "PostSnapshot" WHERE "postId" = 1) AS "postExposure",
            (SELECT "exposureState" FROM "ReplySnapshot" WHERE "replyId" = 1) AS "replyExposure",
            (SELECT "public" FROM "Article" WHERE "lid" = 'abc12345') AS "articlePublic",
            (SELECT "visibilityState" FROM "Article" WHERE "lid" = 'abc12345') AS "articleState",
            (SELECT "exposureState" FROM "ArticleSnapshot" WHERE "articleId" = 'abc12345') AS "articleExposure",
            (SELECT "exposureState" FROM "ArticleReply" WHERE "id" = 2) AS "commentExposure"
        `);
            assert.deepEqual(result.rows[0], {
              postPublic: false,
              postState: "unverified",
              postExposure: "unverified",
              replyExposure: "unverified",
              articlePublic: false,
              articleState: "unverified",
              articleExposure: "unverified",
              commentExposure: "unverified",
            });
          } finally {
            await temporary.end().catch(() => undefined);
            await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
            await admin.end();
          }
        },
      );

      await t.test(
        "visibility, staleness and takedowns fail closed in queries",
        async () => {
          await resetData();
          await seedPublicDependencies();
          await db.execute(sql`
        INSERT INTO "Article" (
          "lid", "time", "authorId", "upvote", "replyCount", "favorCount", "public",
          "visibilityState", "visibilityCheckedAt", "visibilitySource", "updatedAt"
        ) VALUES ('unverif1', NOW(), 1, 0, 0, 0, TRUE, 'public', NOW(), 'anonymous_upstream', NOW());
        INSERT INTO "ArticleSnapshot" (
          "articleId", "title", "category", "status", "promoteStatus", "content",
          "capturedAt", "lastSeenAt"
        ) VALUES ('unverif1', 'hidden', 1, 2, 0, 'hidden-article', NOW(), NOW());

        INSERT INTO "Post" (
          "id", "time", "replyCount", "public", "visibilityState",
          "visibilityCheckedAt", "visibilitySource", "updatedAt"
        ) VALUES
          (10, NOW(), 0, FALSE, 'restricted', NOW(), 'anonymous_upstream', NOW()),
          (11, NOW(), 1, TRUE, 'public', NOW(), 'anonymous_upstream', NOW());
        INSERT INTO "PostSnapshot" (
          "postId", "title", "authorId", "forumSlug", "topped", "locked", "content",
          "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        ) VALUES
          (10, 'restricted', 1, 'test-forum', FALSE, FALSE, 'hidden-post', 'public', NOW(), 'anonymous_upstream', NOW(), NOW()),
          (11, 'takedown', 1, 'test-forum', FALSE, FALSE, 'taken-post', 'public', NOW(), 'anonymous_upstream', NOW(), NOW());
        INSERT INTO "PostTakedown" ("postId", "submitterId", "reason") VALUES (11, 1, 'private reason');

        INSERT INTO "Post" (
          "id", "time", "replyCount", "public", "visibilityState",
          "visibilityCheckedAt", "visibilitySource", "updatedAt"
        ) VALUES (12, NOW(), 1, TRUE, 'public', NOW(), 'anonymous_upstream', NOW());
        INSERT INTO "PostSnapshot" (
          "postId", "title", "authorId", "forumSlug", "topped", "locked", "content",
          "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        ) VALUES (12, 'reply parent', 1, 'test-forum', FALSE, FALSE, 'body', 'public', NOW(), 'anonymous_upstream', NOW(), NOW());
        INSERT INTO "Reply" ("id", "postId", "authorId", "time") VALUES
          (120, 12, 1, NOW()),
          (121, 12, 1, NOW());
        INSERT INTO "ReplySnapshot" (
          "replyId", "content", "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        ) VALUES
          (120, 'taken reply', 'public', NOW(), 'anonymous_upstream', NOW(), NOW()),
          (121, 'visible reply', 'public', NOW(), 'anonymous_upstream', NOW(), NOW());
        INSERT INTO "ReplyTakedown" ("replyId", "submitterId", "reason") VALUES (120, 1, 'private reason');

        INSERT INTO "Paste" (
          "id", "time", "public", "userId", "visibilityState", "visibilityCheckedAt", "visibilitySource"
        ) VALUES ('stalepst', NOW(), TRUE, 1, 'public', NOW() - INTERVAL '30 days', 'anonymous_upstream');
        INSERT INTO "PasteSnapshot" (
          "pasteId", "public", "data", "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        ) VALUES ('stalepst', TRUE, 'stale secret', 'public', NOW(), 'anonymous_upstream', NOW(), NOW());
      `);

          assert.equal(await query.getArticleWithSnapshot("unverif1"), null);
          assert.equal(await query.getPostWithSnapshot(10), null);
          assert.equal(await query.getPostWithSnapshot(11), null);
          assert.equal(await query.getReplyWithLatestSnapshot(120), null);
          assert.ok(await query.getReplyWithLatestSnapshot(121));
          assert.equal(await query.getPasteWithSnapshot("stalepst"), null);
          const entries = await query.resolveEntries([
            { type: "article", id: "unverif1" },
            { type: "discuss", id: "10" },
            { type: "discuss", id: "11" },
            { type: "paste", id: "stalepst" },
          ]);
          assert.deepEqual(
            entries.map((entry) => entry.data),
            [null, null, null, null],
          );
        },
      );

      await t.test(
        "a public entity does not expose an unverified historical snapshot",
        async () => {
          await resetData();
          await seedPublicDependencies();
          const old = new Date("2026-01-01T00:00:00.000Z");
          const current = new Date("2026-01-02T00:00:00.000Z");
          await db.execute(sql`
        INSERT INTO "Post" (
          "id", "time", "replyCount", "public", "visibilityState", "visibilityCheckedAt",
          "visibilitySource", "updatedAt"
        ) VALUES (20, NOW(), 0, TRUE, 'public', NOW(), 'anonymous_upstream', NOW())
      `);
          await db.execute(sql`
        INSERT INTO "PostSnapshot" (
          "postId", "title", "authorId", "forumSlug", "topped", "locked", "content",
          "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        ) VALUES
          (20, 'old', 1, 'test-forum', FALSE, FALSE, 'legacy body', 'unverified', NULL, NULL, ${old}, ${old}),
          (20, 'current', 1, 'test-forum', FALSE, FALSE, 'verified body', 'public', ${current}, 'anonymous_upstream', ${current}, ${current});
      `);
          const storedPostSnapshots = await db
            .select({ capturedAt: schema.PostSnapshot.capturedAt })
            .from(schema.PostSnapshot)
            .orderBy(schema.PostSnapshot.capturedAt);
          assert.equal(
            await query.getPostWithSnapshot(
              20,
              storedPostSnapshots[0].capturedAt,
            ),
            null,
          );
          const currentPost = await query.getPostWithSnapshot(
            20,
            storedPostSnapshots[1].capturedAt,
          );
          const postEvidence = await db.execute(sql`
        SELECT p."visibilityState", p."visibilityCheckedAt", p."visibilitySource",
          s."capturedAt", s."exposureState", s."verifiedPublicAt", s."verifiedSource"
        FROM "Post" p JOIN "PostSnapshot" s ON s."postId" = p."id"
        WHERE p."id" = 20 ORDER BY s."capturedAt"
      `);
          assert.ok(currentPost, JSON.stringify(postEvidence.rows));
          const timeline = await query.getPostSnapshotsTimeline(20);
          assert.deepEqual(
            timeline?.items.map((item) => item.title),
            ["current"],
          );
        },
      );

      await t.test(
        "anonymous revalidation verifies only the observed snapshot",
        async () => {
          await resetData();
          await seedPublicDependencies();
          const old = new Date("2026-01-01T00:00:00.000Z");
          const current = new Date("2026-01-02T00:00:00.000Z");
          await db.execute(sql`
        INSERT INTO "Article" (
          "lid", "time", "authorId", "upvote", "replyCount", "favorCount", "public", "updatedAt"
        ) VALUES ('abc12345', ${old}, 1, 0, 0, 0, FALSE, ${current})
      `);
          await db.execute(sql`
        INSERT INTO "ArticleSnapshot" (
          "articleId", "title", "category", "status", "promoteStatus", "content", "capturedAt", "lastSeenAt"
        ) VALUES
          ('abc12345', 'old', 1, 2, 0, 'old legacy body', ${old}, ${old}),
          ('abc12345', 'current', 1, 2, 0, 'current body', ${current}, ${current});
      `);

          const originalFetch = globalThis.fetch;
          globalThis.fetch = async (input) => {
            const url = String(input);
            const value = url.endsWith("/_lfe/config")
              ? { route: { "article.show": "/api/article/{lid}" } }
              : {
                  status: 200,
                  time: 1_800_000_000,
                  data: {
                    article: {
                      lid: "abc12345",
                      title: "current",
                      time: 1_700_000_000,
                      author: {
                        uid: 1,
                        name: "tester",
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
                      content: "current body",
                      adminNote: null,
                    },
                  },
                };
            return new Response(JSON.stringify(value), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          };
          try {
            await crawler.fetchArticle("abc12345");
          } finally {
            globalThis.fetch = originalFetch;
          }

          const rows = await db.execute(sql`
        SELECT "title", "exposureState", "verifiedSource"
        FROM "ArticleSnapshot"
        WHERE "articleId" = 'abc12345'
        ORDER BY "capturedAt"
      `);
          assert.deepEqual(
            rows.rows.map((row) => [
              row.title,
              row.exposureState,
              row.verifiedSource,
            ]),
            [
              ["old", "unverified", null],
              ["current", "public", "anonymous_upstream"],
            ],
          );
          const storedArticleSnapshots = await db
            .select({ capturedAt: schema.ArticleSnapshot.capturedAt })
            .from(schema.ArticleSnapshot)
            .orderBy(schema.ArticleSnapshot.capturedAt);
          assert.equal(
            await query.getArticleWithSnapshot(
              "abc12345",
              storedArticleSnapshots[0].capturedAt,
            ),
            null,
          );
          const currentArticle = await query.getArticleWithSnapshot(
            "abc12345",
            storedArticleSnapshots[1].capturedAt,
          );
          const articleEvidence = await db.execute(sql`
        SELECT a."visibilityState", a."visibilityCheckedAt", a."visibilitySource",
          s."capturedAt", s."exposureState", s."verifiedPublicAt", s."verifiedSource"
        FROM "Article" a JOIN "ArticleSnapshot" s ON s."articleId" = a."lid"
        WHERE a."lid" = 'abc12345' ORDER BY s."capturedAt"
      `);
          assert.ok(currentArticle, JSON.stringify(articleEvidence.rows));
        },
      );

      await t.test(
        "visibility scans are bounded and persist keyset progress",
        async () => {
          await resetData();
          await seedPublicDependencies();
          await db.execute(sql`
        INSERT INTO "Article" (
          "lid", "time", "authorId", "upvote", "replyCount", "favorCount", "updatedAt"
        )
        SELECT 'v' || lpad(gs::text, 7, '0'), NOW(), 1, 0, 0, 0, NOW()
        FROM generate_series(1, 120) gs
      `);
          const batches = [];
          const enqueue = async (job) => {
            batches.push(job.entityId);
            return { id: `mock-${job.entityId}` };
          };
          const first = await visibility.scanVisibilityBatch(
            "article",
            enqueue,
          );
          const second = await visibility.scanVisibilityBatch(
            "article",
            enqueue,
          );
          const third = await visibility.scanVisibilityBatch(
            "article",
            enqueue,
          );
          assert.deepEqual(
            [first.queued, second.queued, third.queued],
            [50, 50, 20],
          );
          assert.equal(new Set(batches).size, 120);
          const state = await db.execute(sql`
        SELECT "afterId", "cycle" FROM "VisibilityScanState" WHERE "entityType" = 'article'
      `);
          assert.equal(state.rows[0].afterId, null);
          assert.equal(state.rows[0].cycle, 2);
        },
      );

      await t.test(
        "privacy audit reports and explicitly clears every restricted body type",
        async () => {
          await resetData();
          await seedPublicDependencies();
          await db.execute(sql`
            INSERT INTO "Article" (
              "lid", "time", "authorId", "upvote", "replyCount", "favorCount", "updatedAt"
            ) VALUES ('privart1', NOW(), 1, 0, 1, 0, NOW());
            INSERT INTO "ArticleSnapshot" (
              "articleId", "title", "category", "status", "promoteStatus", "content", "capturedAt", "lastSeenAt"
            ) VALUES ('privart1', 'private', 1, 2, 0, 'article-secret-marker', NOW(), NOW());
            INSERT INTO "ArticleReply" (
              "id", "articleId", "authorId", "time", "content", "updatedAt"
            ) VALUES (701, 'privart1', 1, NOW(), 'comment-secret-marker', NOW());

            INSERT INTO "Post" ("id", "time", "replyCount", "updatedAt")
            VALUES (700, NOW(), 1, NOW());
            INSERT INTO "PostSnapshot" (
              "postId", "title", "authorId", "forumSlug", "topped", "locked", "content", "capturedAt", "lastSeenAt"
            ) VALUES (700, 'private', 1, 'test-forum', FALSE, FALSE, 'post-secret-marker', NOW(), NOW());
            INSERT INTO "Reply" ("id", "postId", "authorId", "time") VALUES (700, 700, 1, NOW());
            INSERT INTO "ReplySnapshot" ("replyId", "content", "capturedAt", "lastSeenAt")
            VALUES (700, 'reply-secret-marker', NOW(), NOW());

            INSERT INTO "Paste" ("id", "time", "public", "userId", "visibilityState")
            VALUES ('privpst1', NOW(), FALSE, 1, 'restricted');
            INSERT INTO "PasteSnapshot" ("pasteId", "public", "data", "capturedAt", "lastSeenAt")
            VALUES ('privpst1', FALSE, 'paste-secret-marker', NOW(), NOW());
          `);
          const env = { ...process.env, HARDENING_INTEGRATION: "1" };
          const dryRun = await execFileAsync(
            process.execPath,
            ["apps/worker/dist/privacy-audit.js"],
            { cwd: root, env },
          );
          assert.equal(dryRun.stdout.includes("secret-marker"), false);
          const dryResult = JSON.parse(dryRun.stdout);
          assert.deepEqual(
            Object.fromEntries(
              dryResult.bodyFindings.map((row) => [row.bodyType, row.records]),
            ),
            {
              articleReply: 1,
              articleSnapshot: 1,
              pasteSnapshot: 1,
              postSnapshot: 1,
              replySnapshot: 1,
            },
          );
          const before = await db.execute(sql`
            SELECT "content" FROM "PostSnapshot" WHERE "postId" = 700
          `);
          assert.equal(before.rows[0].content, "post-secret-marker");

          const applied = await execFileAsync(
            process.execPath,
            ["apps/worker/dist/privacy-audit.js", "--apply"],
            { cwd: root, env },
          );
          assert.equal(applied.stdout.includes("secret-marker"), false);
          const cleared = await db.execute(sql`
            SELECT
              (SELECT "content" FROM "ArticleSnapshot" WHERE "articleId" = 'privart1') AS "article",
              (SELECT "content" FROM "ArticleReply" WHERE "id" = 701) AS "comment",
              (SELECT "content" FROM "PostSnapshot" WHERE "postId" = 700) AS "post",
              (SELECT "content" FROM "ReplySnapshot" WHERE "replyId" = 700) AS "reply",
              (SELECT "data" FROM "PasteSnapshot" WHERE "pasteId" = 'privpst1') AS "paste"
          `);
          assert.deepEqual(cleared.rows[0], {
            article: "",
            comment: "",
            post: "",
            reply: "",
            paste: null,
          });
        },
      );

      await t.test(
        "completed cursors stay O(1) and delta backfills stop at overlap",
        async () => {
          await resetData();
          await db.execute(sql`
        INSERT INTO "CrawlCursor" (
          "entityType", "entityId", "direction", "nextCursor", "status",
          "pagesProcessed", "version", "completedAt", "updatedAt"
        ) VALUES ('discussionReplies', '100', 'older', NULL, 'completed', 100, 1, NOW(), NOW())
      `);
          for (let index = 0; index < 100; index += 1) {
            await backfill.ensureBackfill({
              entityType: "discussionReplies",
              entityId: "100",
              initialCursor: "99",
            });
          }
          assert.equal(
            (await queue.backfillQueue.getJobCounts("wait")).wait,
            0,
          );
          let [cursor] = (
            await db.execute(
              sql`SELECT * FROM "CrawlCursor" WHERE "entityId" = '100'`,
            )
          ).rows;
          assert.equal(cursor.version, 1);
          assert.equal(cursor.status, "completed");

          await backfill.ensureBackfill({
            entityType: "discussionReplies",
            entityId: "100",
            initialCursor: "102",
            reopen: "delta",
          });
          for (const page of [102, 101, 100]) {
            const job = {
              type: "backfill",
              entityType: "discussionReplies",
              entityId: "100",
              direction: "older",
              cursor: String(page),
              version: 2,
            };
            const claimed = await backfill.claimBackfill(job);
            assert.ok(claimed);
            await backfill.advanceBackfill(
              job,
              policy.discussionNextCursor({
                page,
                numReplies: 10,
                numNewReplies: page === 100 ? 0 : 10,
                pagesProcessed: claimed.pagesProcessed,
                maximumPages: 1_000,
              }),
            );
          }
          [cursor] = (
            await db.execute(
              sql`SELECT * FROM "CrawlCursor" WHERE "entityId" = '100'`,
            )
          ).rows;
          assert.equal(cursor.status, "completed");
          assert.equal(cursor.version, 2);
          assert.equal(cursor.pagesProcessed, 3);
        },
      );

      await t.test(
        "page limits pause with the next cursor intact",
        async () => {
          await resetData();
          await db.execute(sql`
        INSERT INTO "CrawlCursor" (
          "entityType", "entityId", "direction", "nextCursor", "status", "pagesProcessed", "version", "updatedAt"
        ) VALUES ('discussionReplies', '200', 'older', '99', 'pending', 0, 1, NOW())
      `);
          const job = {
            type: "backfill",
            entityType: "discussionReplies",
            entityId: "200",
            direction: "older",
            cursor: "99",
            version: 1,
          };
          const claimed = await backfill.claimBackfill(job);
          await backfill.advanceBackfill(
            job,
            policy.discussionNextCursor({
              page: 99,
              numReplies: 10,
              numNewReplies: 10,
              pagesProcessed: claimed.pagesProcessed,
              maximumPages: 1,
            }),
          );
          const row = (
            await db.execute(
              sql`SELECT * FROM "CrawlCursor" WHERE "entityId" = '200'`,
            )
          ).rows[0];
          assert.equal(row.status, "paused");
          assert.equal(row.nextCursor, "98");
          assert.equal(row.lastError, "page_limit");
        },
      );

      await t.test(
        "terminal deterministic jobs pause cursors and explicit resume versions them",
        async () => {
          await resetData();
          const job = {
            type: "backfill",
            entityType: "discussionReplies",
            entityId: "300",
            direction: "older",
            cursor: "42",
            version: 1,
          };
          await db.execute(sql`
        INSERT INTO "CrawlCursor" (
          "entityType", "entityId", "direction", "nextCursor", "status", "pagesProcessed", "version", "updatedAt"
        ) VALUES ('discussionReplies', '300', 'older', '42', 'pending', 0, 1, NOW())
      `);
          const failingWorker = new bullmq.Worker(
            queue.BACKFILL_QUEUE_NAME,
            async () => {
              throw new Error("terminal test failure");
            },
            { connection: queue.redisConnection() },
          );
          const failedJob = await queue.backfillQueue.add("backfill", job, {
            jobId: queue.backfillJobId(job),
            attempts: 1,
            removeOnFail: false,
          });
          await waitFor(
            async () => (await failedJob.getState()) === "failed",
            "failed deterministic job",
          );
          await failingWorker.close();

          const resumeResult = await backfill.resumeBackfills();
          assert.equal(resumeResult.terminalConflicts, 1);
          let row = (
            await db.execute(
              sql`SELECT * FROM "CrawlCursor" WHERE "entityId" = '300'`,
            )
          ).rows[0];
          assert.equal(row.status, "paused");

          await backfill.ensureBackfill({
            entityType: "discussionReplies",
            entityId: "300",
            initialCursor: "42",
            reopen: "explicit",
          });
          row = (
            await db.execute(
              sql`SELECT * FROM "CrawlCursor" WHERE "entityId" = '300'`,
            )
          ).rows[0];
          assert.equal(row.status, "pending");
          assert.equal(row.version, 2);
          const resumedJob = await queue.backfillQueue.getJob(
            queue.backfillJobId({ ...job, version: 2 }),
          );
          assert.ok(resumedJob);
          assert.notEqual(await resumedJob.getState(), "failed");
        },
      );

      await t.test(
        "resumeBackfills persists progress past its per-round limit",
        async () => {
          await resetData();
          await db.execute(sql`
        INSERT INTO "CrawlCursor" (
          "entityType", "entityId", "direction", "nextCursor", "status", "pagesProcessed", "version", "updatedAt"
        )
        SELECT 'discussionReplies', gs::text, 'older', '9', 'pending', 0, 1,
          NOW() - INTERVAL '2 days' + gs * INTERVAL '1 second'
        FROM generate_series(1, 1600) gs
      `);
          const first = await backfill.resumeBackfills();
          const second = await backfill.resumeBackfills();
          assert.equal(first.scanned, 1_000);
          assert.equal(second.scanned, 600);
          assert.equal(first.added + second.added, 1_600);
          assert.equal(
            (await queue.backfillQueue.getJobCounts("wait")).wait,
            1_600,
          );
        },
      );

      await t.test(
        "failed retention does not consume runnable admission",
        async () => {
          const pressureQueue = new bullmq.Queue(
            `${process.env.QUEUE_NAME_PREFIX ?? "test-"}pressure-${Date.now().toString(36)}`,
            { connection: queue.redisConnection() },
          );
          try {
            const client = await pressureQueue.client;
            const pipeline = client.pipeline();
            const failedKey = pressureQueue.toKey("failed");
            for (let index = 0; index < 5_000; index += 1) {
              pipeline.zadd(failedKey, Date.now(), `failed-${String(index)}`);
            }
            await pipeline.exec();
            const counts = await queue.getQueueCounts(pressureQueue);
            assert.equal(counts.failed, 5_000);
            assert.equal(queue.runnablePressureDepth(counts), 0);
            assert.equal(
              await queue.hasQueueCapacity(pressureQueue, 100),
              true,
            );
            await pressureQueue.add("accepted", { ok: true });
            assert.equal((await pressureQueue.getJobCounts("wait")).wait, 1);
          } finally {
            await pressureQueue
              .obliterate({ force: true })
              .catch(() => undefined);
            await pressureQueue.close();
          }
        },
      );

      await t.test(
        "entry previews remain bounded for 100 large bodies",
        async () => {
          await resetData();
          await seedPublicDependencies();
          await db.execute(sql`
        INSERT INTO "Post" (
          "id", "time", "replyCount", "public", "visibilityState", "visibilityCheckedAt",
          "visibilitySource", "updatedAt"
        )
        SELECT 10000 + gs, NOW(), 0, TRUE, 'public', NOW(), 'anonymous_upstream', NOW()
        FROM generate_series(1, 100) gs;
        INSERT INTO "PostSnapshot" (
          "postId", "title", "authorId", "forumSlug", "topped", "locked", "content",
          "exposureState", "verifiedPublicAt", "verifiedSource", "capturedAt", "lastSeenAt"
        )
        SELECT 10000 + gs, repeat('T', 2000), 1, 'test-forum', FALSE, FALSE,
          repeat('正文', 50000), 'public', NOW(), 'anonymous_upstream', NOW(), NOW()
        FROM generate_series(1, 100) gs
      `);
          const refs = Array.from({ length: 100 }, (_, index) => ({
            type: "discuss",
            id: String(10001 + index),
          }));
          const entries = await query.resolveEntries(refs);
          const serialized = JSON.stringify(entries);
          assert.ok(Buffer.byteLength(serialized) < 1024 * 1024);
          assert.equal(entries.length, 100);
          for (const entry of entries) {
            assert.ok(entry.data);
            assert.ok(entry.data.preview.length <= 512);
            assert.equal(Object.hasOwn(entry.data, "content"), false);
            assert.equal(Object.hasOwn(entry.data, "data"), false);
          }
        },
      );

      await t.test(
        "legacy retirement is dry-run by default and refuses active jobs",
        async () => {
          await resetData();
          const legacy = new bullmq.Queue(queue.LEGACY_QUEUE_NAME, {
            connection: queue.redisConnection(),
          });
          let releaseActive;
          const activeGate = new Promise((resolve) => {
            releaseActive = resolve;
          });
          const legacyWorker = new bullmq.Worker(
            queue.LEGACY_QUEUE_NAME,
            async (job) => {
              if (job.name === "fail") throw new Error("legacy failed");
              if (job.name === "active") await activeGate;
            },
            { connection: queue.redisConnection(), concurrency: 1 },
          );
          try {
            const failed = await legacy.add(
              "fail",
              { type: "legacy" },
              { attempts: 1 },
            );
            await waitFor(
              async () => (await failed.getState()) === "failed",
              "legacy failure",
            );
            const completed = await legacy.add("complete", { type: "legacy" });
            await waitFor(
              async () => (await completed.getState()) === "completed",
              "legacy completion",
            );
            const active = await legacy.add("active", { type: "legacy" });
            await waitFor(
              async () => (await active.getState()) === "active",
              "legacy active job",
            );
            await legacy.add("waiting", { type: "legacy" }, { priority: 1 });
            await legacy.add("delayed", { type: "legacy" }, { delay: 60_000 });
            await legacy.upsertJobScheduler(
              "legacy-scheduler",
              { pattern: "0 * * * *" },
              { name: "scheduled", data: { type: "legacy" } },
            );
            await queue.refreshQueue.add("new-queue-survives", {
              type: "judgement",
            });

            const env = {
              ...process.env,
              HARDENING_INTEGRATION: "1",
            };
            const dryRun = await execFileAsync(
              process.execPath,
              ["apps/worker/dist/queue-maintenance.js", "--retire-legacy"],
              { cwd: root, env },
            );
            assert.equal(
              JSON.parse(dryRun.stdout).legacyRetirement.mode,
              "dry-run",
            );
            assert.equal(await active.getState(), "active");

            await assert.rejects(
              execFileAsync(
                process.execPath,
                [
                  "apps/worker/dist/queue-maintenance.js",
                  "--retire-legacy",
                  "--apply",
                  "--confirm-old-worker-stopped",
                ],
                { cwd: root, env },
              ),
            );

            releaseActive();
            await waitFor(
              async () => (await active.getState()) !== "active",
              "legacy active job completion",
            );
            await legacyWorker.close();
            const applied = await execFileAsync(
              process.execPath,
              [
                "apps/worker/dist/queue-maintenance.js",
                "--retire-legacy",
                "--apply",
                "--confirm-old-worker-stopped",
              ],
              { cwd: root, env },
            );
            assert.equal(
              JSON.parse(applied.stdout).legacyRetirement.obliterated,
              true,
            );
            assert.equal(
              (await queue.refreshQueue.getJobCounts("wait", "prioritized"))
                .wait +
                (await queue.refreshQueue.getJobCounts("wait", "prioritized"))
                  .prioritized,
              1,
            );
          } finally {
            releaseActive?.();
            await legacyWorker.close().catch(() => undefined);
            await legacy.close();
          }
        },
      );

      await t.test(
        "the real worker pauses a cursor after its final attempt",
        async () => {
          await resetData();
          const workers = await import("../apps/worker/dist/worker.js");
          const job = {
            type: "backfill",
            entityType: "discussionReplies",
            entityId: "400",
            direction: "older",
            cursor: "invalid",
            version: 1,
          };
          await db.execute(sql`
        INSERT INTO "CrawlCursor" (
          "entityType", "entityId", "direction", "nextCursor", "status", "pagesProcessed", "version", "updatedAt"
        ) VALUES ('discussionReplies', '400', 'older', 'invalid', 'pending', 0, 1, NOW())
      `);
          const queued = await queue.backfillQueue.add("backfill", job, {
            jobId: queue.backfillJobId(job),
            attempts: 2,
            backoff: { type: "fixed", delay: 10 },
            removeOnFail: false,
          });
          const runPromise = workers.backfillWorker.run();
          await waitFor(
            async () => (await queued.getState()) === "failed",
            "final worker failure",
          );
          const row = (
            await db.execute(
              sql`SELECT "status", "lastError" FROM "CrawlCursor" WHERE "entityId" = '400'`,
            )
          ).rows[0];
          assert.equal(row.status, "paused");
          assert.match(
            row.lastError,
            /Invalid persisted discussion backfill cursor/,
          );
          await workers.backfillWorker.close();
          await runPromise;
          await workers.refreshWorker.close();
        },
      );
    } finally {
      await cleanQueues();
      await queue.closeQueues();
      await closeDb();
      await logging.closeLogger();
    }
  },
);
