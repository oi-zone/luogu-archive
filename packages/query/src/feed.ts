import { createHash, randomBytes } from "node:crypto";

import { db, sql } from "@luogu-discussion-archive/db";

import { normalizeCopraTags } from "./copra.js";
import type { BasicUserSnapshot, ForumBasicInfo } from "./types.js";

const FEED_DEFAULT_LIMIT = 60;
const FEED_MAX_LIMIT = 80;
const RANDOM_MIN = 0.4;
const RANDOM_MAX = 1.0;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ARTICLE_LOOKBACK_MS = 14 * DAY_IN_MS;
const DISCUSSION_LOOKBACK_MS = 14 * DAY_IN_MS;
const PASTE_LOOKBACK_MS = 30 * DAY_IN_MS;
const JUDGEMENT_LOOKBACK_MS = 30 * DAY_IN_MS;
const ARTICLE_RECENT_REPLY_WINDOW_MS = 2 * DAY_IN_MS;
const DISCUSSION_RECENT_REPLY_WINDOW_MS = 3 * DAY_IN_MS;
const ARTICLE_UPVOTE_DECAY_MS = 30 * DAY_IN_MS;
const FEED_TIME_DECAY_HALF_LIFE_MS = 36 * 60 * 60 * 1000; // 36h 半衰期

const ARTICLE_CANDIDATE_LIMIT = 120;
const DISCUSSION_CANDIDATE_LIMIT = 180;
const PASTE_CANDIDATE_LIMIT = 150;
const JUDGEMENT_CANDIDATE_LIMIT = 80;

export type FeedEntry =
  | ArticleFeedEntry
  | DiscussionFeedEntry
  | PasteFeedEntry
  | JudgementFeedEntry;

interface FeedEntryBase {
  key: string;
  timestamp: string;
  author: BasicUserSnapshot | null;
}

export interface ArticleFeedEntry extends FeedEntryBase {
  kind: "article";
  articleId: string;
  title: string;
  category: number | null;
  summary: string | null;
  tags: string[] | null;
  replyCount: number;
  recentReplyCount: number;
  favorCount: number;
  upvote: number;
}

export interface DiscussionFeedEntry extends FeedEntryBase {
  kind: "discussion";
  postId: number;
  title: string;
  forum: ForumBasicInfo;
  replyCount: number;
  recentReplyCount: number;
}

export interface PasteFeedEntry extends FeedEntryBase {
  kind: "paste";
  pasteId: number;
  title: string;
  preview: string;
  isAuthorPrivileged: boolean;
}

export interface JudgementFeedEntry extends FeedEntryBase {
  kind: "judgement";
  judgementId: string;
  userId: number;
  action: string;
  reason: string;
  addedPermission: number;
  revokedPermission: number;
}

export interface FeedPage {
  seed: string;
  items: FeedEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface FeedCursor {
  seed: string;
  score: number;
  timestamp: number;
  key: string;
}

interface RankedCandidate {
  key: string;
  timestamp: Date;
  score: number;
  entry: FeedEntry;
}

interface CandidateSeed {
  key: string;
  timestamp: Date;
  baseline: number;
  entry: FeedEntry;
}

interface ArticleRow extends Record<string, unknown> {
  articleId: string;
  updatedAt: Date;
  time: Date;
  replyCount: number;
  favorCount: number;
  upvote: number;
  recentReplyCount: number;
  title: string | null;
  category: number | null;
  summary: string | null;
  tags: unknown;
  authorId: number | null;
  authorName: string | null;
  authorBadge: string | null;
  authorColor: string | null;
  authorCcfLevel: number | null;
  authorXcpcLevel: number | null;
}

interface DiscussionRow extends Record<string, unknown> {
  postId: number;
  updatedAt: Date;
  time: Date;
  replyCount: number;
  recentReplyCount: number;
  title: string | null;
  forumSlug: string | null;
  forumName: string | null;
  forumProblemId: string | null;
  forumProblemTitle: string | null;
  forumProblemDifficulty: number | null;
  authorId: number | null;
  authorName: string | null;
  authorBadge: string | null;
  authorColor: string | null;
  authorCcfLevel: number | null;
  authorXcpcLevel: number | null;
}

interface PasteRow extends Record<string, unknown> {
  pasteId: number;
  time: Date;
  preview: string | null;
  authorId: number | null;
  authorName: string | null;
  authorBadge: string | null;
  authorColor: string | null;
  authorCcfLevel: number | null;
  authorXcpcLevel: number | null;
  authorIsAdmin: boolean | null;
  authorIsRoot: boolean | null;
  everPrivileged: boolean | null;
}

interface JudgementRow extends Record<string, unknown> {
  userId: number;
  time: Date;
  reason: string;
  addedPermission: number;
  revokedPermission: number;
  authorName: string | null;
  authorBadge: string | null;
  authorColor: string | null;
  authorCcfLevel: number | null;
  authorXcpcLevel: number | null;
}

// Builds one page of feed entries using the candidate pipeline and cursor pagination.
export async function getFeedPage({
  limit = FEED_DEFAULT_LIMIT,
  cursor,
}: {
  limit?: number;
  cursor?: FeedCursor | null;
} = {}): Promise<FeedPage> {
  const clampedLimit = Math.min(Math.max(limit, 1), FEED_MAX_LIMIT);
  const seed = cursor?.seed ?? generateSeed();
  const candidates = await collectCandidates(seed);

  const sorted = candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const diff = b.timestamp.getTime() - a.timestamp.getTime();
    if (diff !== 0) return diff;
    return a.key.localeCompare(b.key);
  });

  const filtered = cursor
    ? sorted.filter(
        (candidate) => compareCandidateToCursor(candidate, cursor) < 0,
      )
    : sorted;

  const items = filtered.slice(0, clampedLimit);
  const hasMore = filtered.length > clampedLimit;
  const lastItem = hasMore
    ? items[items.length - 1]
    : (items[items.length - 1] ?? null);
  const nextCursor =
    hasMore && lastItem
      ? encodeFeedCursor({
          seed,
          score: lastItem.score,
          timestamp: lastItem.timestamp.getTime(),
          key: lastItem.key,
        })
      : null;

  return {
    seed,
    items: items.map((candidate) => candidate.entry),
    hasMore,
    nextCursor,
  } satisfies FeedPage;
}

// Decodes a base64 cursor back into the tuple used for pagination.
export function parseFeedCursor(raw: string): FeedCursor | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<FeedCursor>;
    if (
      typeof payload.seed !== "string" ||
      typeof payload.score !== "number" ||
      typeof payload.timestamp !== "number" ||
      typeof payload.key !== "string"
    ) {
      return null;
    }
    return payload as FeedCursor;
  } catch {
    return null;
  }
}

// Encodes the pagination tuple into a base64 string for transport to clients.
export function encodeFeedCursor(payload: FeedCursor) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

// Collects all feed candidates, applies scoring with deterministic jitter, and returns ranked entries.
async function collectCandidates(seed: string): Promise<RankedCandidate[]> {
  const now = Date.now();
  const [articleRows, discussionRows, pasteRows, judgementRows] =
    await Promise.all([
      fetchArticleRows(),
      fetchDiscussionRows(),
      fetchPasteRows(),
      fetchJudgementRows(),
    ]);

  const seeds: CandidateSeed[] = [];

  for (const row of articleRows) {
    const timestamp = pickTimestamp(row.updatedAt);
    if (!timestamp) continue;
    const title = row.title?.trim() ?? "未命名文章";
    const author = mapAuthorFromRow(row);
    const publishedAt = pickTimestamp(row.time) ?? timestamp;
    const recentReplyCount = row.recentReplyCount;
    const baseline = computeArticleBaseline({
      recentReplies: recentReplyCount,
      replyCount: row.replyCount,
      favorCount: row.favorCount,
      upvote: row.upvote,
      publishedAt,
    });
    if (baseline <= 0) continue;

    const key = `article:${row.articleId}`;
    const entry: ArticleFeedEntry = {
      kind: "article",
      key,
      timestamp: timestamp.toISOString(),
      author,
      articleId: row.articleId,
      title,
      category: typeof row.category === "number" ? row.category : null,
      summary: typeof row.summary === "string" ? row.summary : null,
      tags: normalizeCopraTags(row.tags),
      replyCount: row.replyCount,
      recentReplyCount,
      favorCount: row.favorCount,
      upvote: row.upvote,
    };

    seeds.push({ key, timestamp, baseline, entry });
  }

  for (const row of discussionRows) {
    const timestamp = pickTimestamp(row.updatedAt);
    if (!timestamp) continue;
    if (!row.title || !row.forumSlug || !row.forumName) continue;
    const author = mapAuthorFromRow(row);
    const baseline = computeDiscussionBaseline({
      recentReplies: row.recentReplyCount,
      replyCount: row.replyCount,
    });
    if (baseline <= 0) continue;

    const forum: ForumBasicInfo = {
      slug: row.forumSlug,
      name: row.forumName,
      problemId: row.forumProblemId ?? null,
      problem:
        row.forumProblemId && row.forumProblemTitle
          ? {
              pid: row.forumProblemId,
              title: row.forumProblemTitle,
              difficulty:
                typeof row.forumProblemDifficulty === "number"
                  ? row.forumProblemDifficulty
                  : null,
            }
          : null,
    };

    const key = `discussion:${row.postId.toString()}`;
    const entry: DiscussionFeedEntry = {
      kind: "discussion",
      key,
      timestamp: timestamp.toISOString(),
      author,
      postId: row.postId,
      title: row.title,
      forum,
      replyCount: row.replyCount,
      recentReplyCount: row.recentReplyCount,
    };

    seeds.push({ key, timestamp, baseline, entry });
  }

  for (const row of pasteRows) {
    const timestamp = pickTimestamp(row.time);
    if (!timestamp) continue;
    const author = mapAuthorFromRow(row);
    const isPrivileged =
      Boolean(row.authorIsAdmin) ||
      Boolean(row.authorIsRoot) ||
      Boolean(row.everPrivileged);
    const baseline = computePasteBaseline({
      isAuthorPrivileged: isPrivileged,
      hasPreview: Boolean(row.preview?.length),
    });
    if (baseline <= 0) continue;

    const key = `paste:${row.pasteId.toString()}`;
    const entry: PasteFeedEntry = {
      kind: "paste",
      key,
      timestamp: timestamp.toISOString(),
      author,
      pasteId: row.pasteId,
      title: `云剪贴板 ${row.pasteId.toString()}`,
      preview: row.preview?.trim() ?? "暂无内容",
      isAuthorPrivileged: isPrivileged,
    };

    seeds.push({ key, timestamp, baseline, entry });
  }

  for (const row of judgementRows) {
    const timestamp = pickTimestamp(row.time);
    if (!timestamp) continue;
    const author = mapJudgedUserFromRow(row);
    const baseline = computeJudgementBaseline({
      added: row.addedPermission,
      revoked: row.revokedPermission,
    });
    if (baseline <= 0) continue;

    const judgementCursor = buildJudgementCursor(timestamp, row.userId);
    const key = `judgement:${judgementCursor}`;
    const entry: JudgementFeedEntry = {
      kind: "judgement",
      key,
      timestamp: timestamp.toISOString(),
      author,
      judgementId: judgementCursor,
      userId: row.userId,
      action: describeJudgementAction(
        row.addedPermission,
        row.revokedPermission,
      ),
      reason: row.reason,
      addedPermission: row.addedPermission,
      revokedPermission: row.revokedPermission,
    };

    seeds.push({ key, timestamp, baseline, entry });
  }

  return seeds
    .map((candidate) => {
      const score = computeFinalScore({
        seed,
        key: candidate.key,
        baseline: candidate.baseline,
        timestamp: candidate.timestamp,
        now,
      });
      if (!Number.isFinite(score) || score <= 0) {
        return null;
      }
      return {
        key: candidate.key,
        timestamp: candidate.timestamp,
        entry: candidate.entry,
        score,
      } satisfies RankedCandidate;
    })
    .filter((item): item is RankedCandidate => item !== null);
}

// Compares a candidate against the cursor tuple to determine if it should appear after the cursor.
function compareCandidateToCursor(
  candidate: RankedCandidate,
  cursor: FeedCursor,
) {
  if (candidate.score !== cursor.score) {
    return candidate.score > cursor.score ? 1 : -1;
  }
  const candidateTime = candidate.timestamp.getTime();
  if (candidateTime !== cursor.timestamp) {
    return candidateTime > cursor.timestamp ? 1 : -1;
  }
  if (candidate.key === cursor.key) return 0;
  return candidate.key > cursor.key ? 1 : -1;
}

// Scores articles based on replies/favorites/upvotes with decay so newer interactions weigh more.
function computeArticleBaseline({
  recentReplies,
  replyCount,
  favorCount,
  upvote,
  publishedAt,
}: {
  recentReplies: number;
  replyCount: number;
  favorCount: number;
  upvote: number;
  publishedAt: Date;
}) {
  const publishedAgeMs = Date.now() - publishedAt.getTime();
  const upvoteDecay = Math.exp(
    -Math.max(0, publishedAgeMs) / ARTICLE_UPVOTE_DECAY_MS,
  );
  const weighted =
    recentReplies * 1.4 +
    replyCount * 0.05 +
    favorCount * 0.3 +
    upvote * 0.8 * upvoteDecay;
  return Math.log1p(Math.max(0, weighted));
}

// Scores discussions with stronger weight on recent replies to highlight active threads.
function computeDiscussionBaseline({
  recentReplies,
  replyCount,
}: {
  recentReplies: number;
  replyCount: number;
}) {
  const weighted = recentReplies * 1.8 + replyCount * 0.04;
  return Math.log1p(Math.max(0, weighted));
}

// Gives cloud pastes a small score bump if作者拥有特权或有正文预览。
function computePasteBaseline({
  isAuthorPrivileged,
  hasPreview,
}: {
  isAuthorPrivileged: boolean;
  hasPreview: boolean;
}) {
  let score = 0.8;
  if (isAuthorPrivileged) score += 0.7;
  if (hasPreview) score += 0.2;
  return score;
}

// Judgements gain weight when权限被增加或撤销，否则保持基础曝光。
function computeJudgementBaseline({
  added,
  revoked,
}: {
  added: number;
  revoked: number;
}) {
  let score = 0.8;
  if (added) score += 0.6;
  if (revoked) score += 0.6;
  return score;
}

// Combines baseline, exponential decay, and deterministic jitter into the final ranking score.
function computeFinalScore({
  seed,
  key,
  baseline,
  timestamp,
  now,
}: {
  seed: string;
  key: string;
  baseline: number;
  timestamp: Date;
  now: number;
}) {
  if (!Number.isFinite(baseline) || baseline <= 0) return 0;
  const ageMs = Math.max(0, now - timestamp.getTime());
  const decay = Math.exp((-Math.log(2) * ageMs) / FEED_TIME_DECAY_HALF_LIFE_MS);
  const jitter = computeDeterministicJitter(seed, key);
  return baseline * decay * jitter;
}

// Produces a reproducible jitter multiplier so不同seed的刷新顺序带有随机感。
function computeDeterministicJitter(seed: string, key: string) {
  const hash = createHash("sha256")
    .update(seed)
    .update(":")
    .update(key)
    .digest();
  const value = hash.readUInt32BE(0) / 0xffffffff;
  return RANDOM_MIN + (RANDOM_MAX - RANDOM_MIN) * value;
}

// Generates the per-page seed used to keep jitter consistent across pagination.
function generateSeed() {
  return randomBytes(8).toString("hex");
}

// Guards against invalid dates coming back from SQL rows.
function pickTimestamp(value: Date | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp;
}

// Maps joined user snapshot fields into the BasicUserSnapshot shape.
function mapAuthorFromRow(row: {
  authorId: number | null;
  authorName: string | null;
  authorBadge: string | null;
  authorColor: string | null;
  authorCcfLevel: number | null;
  authorXcpcLevel: number | null;
}): BasicUserSnapshot | null {
  if (!row.authorId || !row.authorName || !row.authorColor) {
    return null;
  }
  return {
    id: row.authorId,
    name: row.authorName,
    badge: row.authorBadge ?? null,
    color: row.authorColor,
    ccfLevel: row.authorCcfLevel ?? 0,
    xcpcLevel: row.authorXcpcLevel ?? 0,
  } satisfies BasicUserSnapshot;
}

// Judgement rows reuse the same mapping but keyed by被裁决用户。
function mapJudgedUserFromRow(row: JudgementRow): BasicUserSnapshot | null {
  if (!row.userId || !row.authorName || !row.authorColor) {
    return null;
  }
  return {
    id: row.userId,
    name: row.authorName,
    badge: row.authorBadge ?? null,
    color: row.authorColor,
    ccfLevel: row.authorCcfLevel ?? 0,
    xcpcLevel: row.authorXcpcLevel ?? 0,
  } satisfies BasicUserSnapshot;
}

// Formats permission deltas into一句可读的裁决描述。
function describeJudgementAction(added: number, revoked: number) {
  const parts: string[] = [];
  if (added) parts.push(`增加权限 ${String(added)}`);
  if (revoked) parts.push(`撤销权限 ${String(revoked)}`);
  if (parts.length === 0) return "社区裁决";
  return parts.join("，");
}

// Uses时间戳+用户ID生成唯一游标键，既当 cursor 也当 entry key。
function buildJudgementCursor(time: Date, userId: number) {
  return `${time.getTime().toString(36)}-${userId.toString(36)}`;
}

const ARTICLE_COPRA_SCHEMA_ERROR_CODES = new Set(["42P01", "42703"]);
let skipArticleCopraJoin = false;

// Pulls recent文章候选，连同最新快照/作者信息/近期回复数。
async function fetchArticleRows() {
  const since = new Date(Date.now() - ARTICLE_LOOKBACK_MS);
  const recentSince = new Date(Date.now() - ARTICLE_RECENT_REPLY_WINDOW_MS);

  if (skipArticleCopraJoin) {
    return executeArticleRowsQuery({ since, recentSince, includeCopra: false });
  }

  try {
    return await executeArticleRowsQuery({
      since,
      recentSince,
      includeCopra: true,
    });
  } catch (error) {
    if (!isArticleCopraSchemaError(error)) {
      throw error;
    }

    skipArticleCopraJoin = true;
    console.warn(
      "[feed] ArticleCopra join disabled after schema error",
      error instanceof Error ? error.message : error,
    );

    return executeArticleRowsQuery({ since, recentSince, includeCopra: false });
  }
}

function isArticleCopraSchemaError(error: unknown) {
  const code = extractPostgresErrorCode(error);
  return Boolean(code && ARTICLE_COPRA_SCHEMA_ERROR_CODES.has(code));
}

function extractPostgresErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string") {
    return candidate.code;
  }
  const { cause } = candidate;
  if (cause && typeof cause === "object") {
    const causeWithCode = cause as { code?: unknown };
    if (typeof causeWithCode.code === "string") {
      return causeWithCode.code;
    }
  }
  return null;
}

async function executeArticleRowsQuery({
  since,
  recentSince,
  includeCopra,
}: {
  since: Date;
  recentSince: Date;
  includeCopra: boolean;
}) {
  const summarySelection = includeCopra ? sql`ac."summary"` : sql`NULL::text`;
  const tagsSelection = includeCopra ? sql`ac."tags"` : sql`NULL::text`;
  const copraJoin = includeCopra
    ? sql`LEFT JOIN "ArticleCopra" ac ON ac."articleId" = a."lid"`
    : sql``;

  const { rows } = await db.execute<ArticleRow>(sql`
    WITH latest_user AS (
      SELECT DISTINCT ON ("userId")
        "userId",
        "name",
        "badge",
        "color",
        "ccfLevel",
        "xcpcLevel"
      FROM "UserSnapshot"
      ORDER BY "userId", "capturedAt" DESC
    ),
    latest_article_snapshot AS (
      SELECT DISTINCT ON ("articleId")
        "articleId",
        "title",
        "category"
      FROM "ArticleSnapshot"
      ORDER BY "articleId", "capturedAt" DESC
    ),
    recent_article_replies AS (
      SELECT "articleId", COUNT(*)::int AS "recentReplyCount"
      FROM "ArticleReply"
      WHERE "time" >= ${recentSince}
      GROUP BY "articleId"
    )
    SELECT
      a."lid" AS "articleId",
      a."updatedAt",
      a."time",
      a."replyCount",
      a."favorCount",
      a."upvote",
      COALESCE(rar."recentReplyCount", 0) AS "recentReplyCount",
      las."title" AS "title",
      las."category" AS "category",
      ${summarySelection} AS "summary",
      ${tagsSelection} AS "tags",
      au."userId" AS "authorId",
      au."name" AS "authorName",
      au."badge" AS "authorBadge",
      au."color" AS "authorColor",
      au."ccfLevel" AS "authorCcfLevel",
      au."xcpcLevel" AS "authorXcpcLevel"
    FROM "Article" a
    JOIN latest_article_snapshot las ON las."articleId" = a."lid"
    LEFT JOIN recent_article_replies rar ON rar."articleId" = a."lid"
    LEFT JOIN latest_user au ON au."userId" = a."authorId"
    ${copraJoin}
    WHERE a."updatedAt" >= ${since}
    ORDER BY a."updatedAt" DESC
    LIMIT ${ARTICLE_CANDIDATE_LIMIT}
  `);

  return rows;
}

// 拉取最近讨论并过滤掉下架帖子，同时包含论坛信息与近期回复量。
async function fetchDiscussionRows() {
  const since = new Date(Date.now() - DISCUSSION_LOOKBACK_MS);
  const recentSince = new Date(Date.now() - DISCUSSION_RECENT_REPLY_WINDOW_MS);

  const { rows } = await db.execute<DiscussionRow>(sql`
    WITH latest_user AS (
      SELECT DISTINCT ON ("userId")
        "userId",
        "name",
        "badge",
        "color",
        "ccfLevel",
        "xcpcLevel"
      FROM "UserSnapshot"
      ORDER BY "userId", "capturedAt" DESC
    ),
    latest_post_snapshot AS (
      SELECT DISTINCT ON (ps."postId")
        ps."postId",
        ps."title",
        ps."authorId",
        ps."forumSlug",
        f."name" AS "forumName",
        f."problemId" AS "forumProblemId",
        pr."title" AS "forumProblemTitle",
        pr."difficulty" AS "forumProblemDifficulty"
      FROM "PostSnapshot" ps
      JOIN "Forum" f ON f."slug" = ps."forumSlug"
      LEFT JOIN "Problem" pr ON pr."pid" = f."problemId"
      ORDER BY ps."postId", ps."capturedAt" DESC
    ),
    recent_reply_counts AS (
      SELECT "postId", COUNT(*)::int AS "recentReplyCount"
      FROM "Reply"
      WHERE "time" >= ${recentSince}
      GROUP BY "postId"
    )
    SELECT
      p."id" AS "postId",
      p."updatedAt",
      p."time",
      p."replyCount",
      COALESCE(rdr."recentReplyCount", 0) AS "recentReplyCount",
      lps."title",
      lps."forumSlug",
      lps."forumName",
      lps."forumProblemId",
      lps."forumProblemTitle",
      lps."forumProblemDifficulty",
      au."userId" AS "authorId",
      au."name" AS "authorName",
      au."badge" AS "authorBadge",
      au."color" AS "authorColor",
      au."ccfLevel" AS "authorCcfLevel",
      au."xcpcLevel" AS "authorXcpcLevel"
    FROM "Post" p
    JOIN latest_post_snapshot lps ON lps."postId" = p."id"
    LEFT JOIN recent_reply_counts rdr ON rdr."postId" = p."id"
    LEFT JOIN latest_user au ON au."userId" = lps."authorId"
    LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
    WHERE pt."postId" IS NULL
      AND p."updatedAt" >= ${since}
    ORDER BY p."updatedAt" DESC
    LIMIT ${DISCUSSION_CANDIDATE_LIMIT}
  `);

  return rows;
}

// 查询近 30 天的云剪贴以及作者特权状态与最新内容预览。
async function fetchPasteRows() {
  const since = new Date(Date.now() - PASTE_LOOKBACK_MS);

  const { rows } = await db.execute<PasteRow>(sql`
    WITH latest_user AS (
      SELECT DISTINCT ON ("userId")
        "userId",
        "name",
        "badge",
        "color",
        "ccfLevel",
        "xcpcLevel",
        "isAdmin",
        "isRoot"
      FROM "UserSnapshot"
      ORDER BY "userId", "capturedAt" DESC
    ),
    latest_paste_snapshot AS (
      SELECT DISTINCT ON ("pasteId")
        "pasteId",
        btrim(regexp_replace(COALESCE("data", ''), '\\s+', ' ', 'g')) AS "preview"
      FROM "PasteSnapshot"
      ORDER BY "pasteId", "capturedAt" DESC
    ),
    ever_privileged AS (
      SELECT DISTINCT "userId"
      FROM "UserSnapshot"
      WHERE "isAdmin" = TRUE OR "isRoot" = TRUE
    )
    SELECT
      pst."id" AS "pasteId",
      pst."time",
      lps."preview",
      au."userId" AS "authorId",
      au."name" AS "authorName",
      au."badge" AS "authorBadge",
      au."color" AS "authorColor",
      au."ccfLevel" AS "authorCcfLevel",
      au."xcpcLevel" AS "authorXcpcLevel",
      au."isAdmin" AS "authorIsAdmin",
      au."isRoot" AS "authorIsRoot",
      (ep."userId" IS NOT NULL) AS "everPrivileged"
    FROM "Paste" pst
    LEFT JOIN latest_paste_snapshot lps ON lps."pasteId" = pst."id"
    LEFT JOIN latest_user au ON au."userId" = pst."userId"
    LEFT JOIN ever_privileged ep ON ep."userId" = pst."userId"
    WHERE pst."time" >= ${since}
    ORDER BY pst."time" DESC
    LIMIT ${PASTE_CANDIDATE_LIMIT}
  `);

  return rows;
}

// 读取最近的社区裁决并联结用户快照以供前端展示。
async function fetchJudgementRows() {
  const since = new Date(Date.now() - JUDGEMENT_LOOKBACK_MS);

  const { rows } = await db.execute<JudgementRow>(sql`
    WITH latest_user AS (
      SELECT DISTINCT ON ("userId")
        "userId",
        "name",
        "badge",
        "color",
        "ccfLevel",
        "xcpcLevel"
      FROM "UserSnapshot"
      ORDER BY "userId", "capturedAt" DESC
    )
    SELECT
      j."userId",
      j."time",
      j."reason",
      j."addedPermission",
      j."revokedPermission",
      au."name" AS "authorName",
      au."badge" AS "authorBadge",
      au."color" AS "authorColor",
      au."ccfLevel" AS "authorCcfLevel",
      au."xcpcLevel" AS "authorXcpcLevel"
    FROM "Judgement" j
    LEFT JOIN latest_user au ON au."userId" = j."userId"
    WHERE j."time" >= ${since}
    ORDER BY j."time" DESC
    LIMIT ${JUDGEMENT_CANDIDATE_LIMIT}
  `);

  return rows;
}
