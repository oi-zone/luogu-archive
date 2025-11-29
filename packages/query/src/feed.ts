import { createHash, randomBytes } from "node:crypto";

import { db, sql } from "@luogu-discussion-archive/db/drizzle";

import {
  ARTICLE_SCORE_WEIGHT,
  FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS,
  FEATURED_ARTICLE_DEFAULT_WINDOW_MS,
} from "./article.js";
import type { BasicUserSnapshot } from "./types.js";

const FEED_DEFAULT_LIMIT = 40;
const FEED_MAX_LIMIT = 80;
const FEED_CANDIDATE_LIMIT = 200;
const FEED_TIME_DECAY_HALF_LIFE_MS = 36 * 60 * 60 * 1000; // 36h half-life
const FEED_RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days for discussions
const FEED_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for paste/judgement
const RANDOM_MIN = 0.3;
const RANDOM_MAX = 1.0;

const CURSOR_VERSION = 1;

export type FeedEntry =
  | ArticleFeedEntry
  | DiscussionFeedEntry
  | PasteFeedEntry
  | JudgementFeedEntry;

export interface ArticleFeedEntry {
  type: "article";
  id: string;
  title: string;
  replyCount: number;
  recentReplyCount: number;
  upvote: number;
  favorCount: number;
  href: string;
  author: BasicUserSnapshot | null;
  publishedAt: string;
}

export interface DiscussionFeedEntry {
  type: "discussion";
  id: number;
  title: string;
  forum: string;
  replyCount: number;
  recentReplyCount: number;
  href: string;
  author: BasicUserSnapshot | null;
  updatedAt: string;
}

export interface PasteFeedEntry {
  type: "paste";
  id: string;
  title: string;
  preview: string;
  isAuthorPrivileged: boolean;
  author: BasicUserSnapshot | null;
  href: string;
  createdAt: string;
}

export interface JudgementFeedEntry {
  type: "judgement";
  id: string;
  action: string;
  reason: string;
  addedPermission: number;
  revokedPermission: number;
  anchor: string;
  href: string;
  user: BasicUserSnapshot | null;
  createdAt: string;
}

export interface FeedPage {
  seed: string;
  items: FeedEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface RankedCandidate {
  key: string;
  timestamp: Date;
  score: number;
  payload: FeedEntry;
}

interface FeedCursorPayload {
  v: number;
  seed: string;
  score: number;
  timestamp: number;
  key: string;
}

export type FeedCursor = FeedCursorPayload;

interface FeedQueryRow extends Record<string, unknown> {
  type: FeedEntry["type"];
  key: string;
  timestamp: Date;
  baseline: number | null;
  data: unknown;
}

async function fetchFeedRows(): Promise<FeedQueryRow[]> {
  const articleWindowSeconds = FEATURED_ARTICLE_DEFAULT_WINDOW_MS / 1000;
  const discussionWindowSeconds = FEED_RECENT_WINDOW_MS / 1000;
  const lookbackWindowSeconds = FEED_LOOKBACK_MS / 1000;
  const articleUpvoteDecaySeconds =
    FEATURED_ARTICLE_DEFAULT_UPVOTE_DECAY_MS / 1000;

  const { rows } = await db.execute<FeedQueryRow>(sql`
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
    ever_privileged AS (
      SELECT DISTINCT "userId"
      FROM "UserSnapshot"
      WHERE "isAdmin" = TRUE OR "isRoot" = TRUE
    ),
    latest_article_snapshot AS (
      SELECT DISTINCT ON ("articleId")
        "articleId",
        "title"
      FROM "ArticleSnapshot"
      ORDER BY "articleId", "capturedAt" DESC
    ),
    recent_article_replies AS (
      SELECT "articleId", COUNT(*)::int AS "recentReplyCount"
      FROM "ArticleReply"
      WHERE "time" >= NOW() - ${articleWindowSeconds} * INTERVAL '1 second'
      GROUP BY "articleId"
    ),
    latest_post_snapshot AS (
      SELECT DISTINCT ON (ps."postId")
        ps."postId",
        ps."title",
        ps."authorId",
        ps."forumSlug",
        f."name" AS "forumName"
      FROM "PostSnapshot" ps
      JOIN "Forum" f ON f."slug" = ps."forumSlug"
      ORDER BY ps."postId", ps."capturedAt" DESC
    ),
    recent_discussion_replies AS (
      SELECT "postId", COUNT(*)::int AS "recentReplyCount"
      FROM "Reply"
      WHERE "time" >= NOW() - ${discussionWindowSeconds} * INTERVAL '1 second'
      GROUP BY "postId"
    ),
    latest_paste_snapshot AS (
      SELECT DISTINCT ON ("pasteId")
        "pasteId",
        btrim(regexp_replace(COALESCE("data", ''), '\\s+', ' ', 'g')) AS "normalized"
      FROM "PasteSnapshot"
      ORDER BY "pasteId", "capturedAt" DESC
    ),
    article_candidates AS (
      SELECT
        'article'::text AS type,
        'article:' || a."lid" AS key,
        a."updatedAt" AS timestamp,
        (
          LOG(
            10,
            GREATEST(
              1,
              1
                + (
                  COALESCE(rar."recentReplyCount", 0) * ${ARTICLE_SCORE_WEIGHT.replies}
                  + a."favorCount" * ${ARTICLE_SCORE_WEIGHT.favorites}
                  + a."upvote"
                    * EXP(-EXTRACT(EPOCH FROM (NOW() - a."time")) / ${articleUpvoteDecaySeconds})
                    * ${ARTICLE_SCORE_WEIGHT.upvotes}
                )
            )
          ) * 10
        )::double precision AS baseline,
        jsonb_build_object(
          'type', 'article',
          'id', a."lid",
          'title', las."title",
          'replyCount', a."replyCount",
          'recentReplyCount', COALESCE(rar."recentReplyCount", 0),
          'favorCount', a."favorCount",
          'upvote', a."upvote",
          'href', '/a/' || a."lid",
          'author', CASE
            WHEN aua."userId" IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', aua."userId",
              'name', aua."name",
              'badge', aua."badge",
              'color', aua."color",
              'ccfLevel', aua."ccfLevel",
              'xcpcLevel', aua."xcpcLevel"
            )
          END,
          'publishedAt', a."time"
        ) AS data
      FROM "Article" a
      JOIN latest_article_snapshot las ON las."articleId" = a."lid"
      LEFT JOIN recent_article_replies rar ON rar."articleId" = a."lid"
      LEFT JOIN latest_user aua ON aua."userId" = a."authorId"
      ORDER BY a."updatedAt" DESC
      LIMIT ${FEED_CANDIDATE_LIMIT}
    ),
    discussion_candidates AS (
      SELECT
        'discussion'::text AS type,
        'discussion:' || p."id" AS key,
        p."time" AS timestamp,
        (
          LOG(
            10,
            GREATEST(1, 1 + (COALESCE(rdr."recentReplyCount", 0) * 1000))
          ) * 10
        )::double precision AS baseline,
        jsonb_build_object(
          'type', 'discussion',
          'id', p."id",
          'title', lps."title",
          'forum', lps."forumName",
          'replyCount', p."replyCount",
          'recentReplyCount', COALESCE(rdr."recentReplyCount", 0),
          'href', '/d/' || p."id",
          'author', CASE
            WHEN dua."userId" IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', dua."userId",
              'name', dua."name",
              'badge', dua."badge",
              'color', dua."color",
              'ccfLevel', dua."ccfLevel",
              'xcpcLevel', dua."xcpcLevel"
            )
          END,
          'publishedAt', p."time"
        ) AS data
      FROM "Post" p
      JOIN latest_post_snapshot lps ON lps."postId" = p."id"
      LEFT JOIN recent_discussion_replies rdr ON rdr."postId" = p."id"
      LEFT JOIN latest_user dua ON dua."userId" = lps."authorId"
      LEFT JOIN "PostTakedown" pt ON pt."postId" = p."id"
      WHERE pt."postId" IS NULL
        AND p."time" >= NOW() - ${lookbackWindowSeconds} * INTERVAL '1 second'
      ORDER BY p."publishedAt" DESC
      LIMIT ${FEED_CANDIDATE_LIMIT}
    ),
    paste_candidates AS (
      SELECT
        'paste'::text AS type,
        'paste:' || pst."id" AS key,
        pst."time" AS timestamp,
        (
          20
          + CASE
            WHEN COALESCE(pua."isAdmin", FALSE) OR COALESCE(pua."isRoot", FALSE) THEN 10
            ELSE 0
          END
          + CASE WHEN ep."userId" IS NOT NULL THEN 5 ELSE 0 END
        )::double precision AS baseline,
        jsonb_build_object(
          'type', 'paste',
          'id', pst."id",
          'title', '云剪贴板 ' || pst."id",
          'preview', CASE
            WHEN COALESCE(lps."normalized", '') = '' THEN '暂无内容'
            WHEN char_length(lps."normalized") > 140 THEN substr(lps."normalized", 1, 140) || '…'
            ELSE lps."normalized"
          END,
          'isAuthorPrivileged', COALESCE(pua."isAdmin", FALSE) OR COALESCE(pua."isRoot", FALSE),
          'href', '/p/' || pst."id",
          'author', CASE
            WHEN pua."userId" IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', pua."userId",
              'name', pua."name",
              'badge', pua."badge",
              'color', pua."color",
              'ccfLevel', pua."ccfLevel",
              'xcpcLevel', pua."xcpcLevel"
            )
          END,
          'createdAt', pst."time"
        ) AS data
      FROM "Paste" pst
      LEFT JOIN latest_paste_snapshot lps ON lps."pasteId" = pst."id"
      LEFT JOIN latest_user pua ON pua."userId" = pst."userId"
      LEFT JOIN ever_privileged ep ON ep."userId" = pst."userId"
      WHERE pst."time" >= NOW() - ${lookbackWindowSeconds} * INTERVAL '1 second'
      ORDER BY pst."time" DESC
      LIMIT ${FEED_CANDIDATE_LIMIT}
    ),
    judgement_candidates AS (
      SELECT
        'judgement'::text AS type,
        'judgement:' || j."userId" || ':' || (floor(EXTRACT(EPOCH FROM j."time") * 1000))::bigint AS key,
        j."time" AS timestamp,
        (5 + CASE WHEN j."addedPermission" <> 0 THEN 5 ELSE 0 END)::double precision AS baseline,
        jsonb_build_object(
          'type', 'judgement',
          'id', j."userId" || '-' || (floor(EXTRACT(EPOCH FROM j."time") * 1000))::bigint,
          'userId', j."userId",
          'action', CASE
            WHEN j."addedPermission" <> 0 AND j."revokedPermission" <> 0 THEN '增加权限 ' || j."addedPermission" || '，撤销权限 ' || j."revokedPermission"
            WHEN j."addedPermission" <> 0 THEN '增加权限 ' || j."addedPermission"
            WHEN j."revokedPermission" <> 0 THEN '撤销权限 ' || j."revokedPermission"
            ELSE '社区裁决'
          END,
          'reason', j."reason",
          'addedPermission', j."addedPermission",
          'revokedPermission', j."revokedPermission",
          'href', '/ostraka',
          'user', CASE
            WHEN juser."userId" IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', juser."userId",
              'name', juser."name",
              'badge', juser."badge",
              'color', juser."color",
              'ccfLevel', juser."ccfLevel",
              'xcpcLevel', juser."xcpcLevel"
            )
          END,
          'createdAt', j."time"
        ) AS data
      FROM "Judgement" j
      LEFT JOIN latest_user juser ON juser."userId" = j."userId"
      WHERE j."time" >= NOW() - ${lookbackWindowSeconds} * INTERVAL '1 second'
      ORDER BY j."time" DESC
      LIMIT ${FEED_CANDIDATE_LIMIT}
    )
    SELECT type, key, timestamp, baseline, data
    FROM (
      SELECT * FROM article_candidates
      UNION ALL
      SELECT * FROM discussion_candidates
      UNION ALL
      SELECT * FROM paste_candidates
      UNION ALL
      SELECT * FROM judgement_candidates
    ) feed_rows;
  `);

  return rows;
}

export async function getFeedPage({
  limit = FEED_DEFAULT_LIMIT,
  cursor,
}: {
  limit?: number;
  cursor?: FeedCursor | null;
} = {}): Promise<FeedPage> {
  const clampedLimit = Math.min(Math.max(limit, 1), FEED_MAX_LIMIT);
  const baseSeed = cursor?.seed ?? generateSeed();

  const candidates = await collectCandidates(baseSeed);
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
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastItem = items[items.length - 1];
    if (lastItem) {
      nextCursor = encodeCursor({
        v: CURSOR_VERSION,
        seed: baseSeed,
        score: lastItem.score,
        timestamp: lastItem.timestamp.getTime(),
        key: lastItem.key,
      });
    }
  }

  return {
    seed: baseSeed,
    items: items.map((item) => item.payload),
    hasMore,
    nextCursor,
  };
}

export function parseFeedCursor(raw: string): FeedCursor | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (typeof decoded !== "object" || decoded === null) {
      return null;
    }
    const payload = decoded as Partial<FeedCursorPayload>;
    if (payload.v !== CURSOR_VERSION) return null;
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

async function collectCandidates(seed: string): Promise<RankedCandidate[]> {
  const now = Date.now();
  const rows = await fetchFeedRows();
  const ranked: RankedCandidate[] = [];

  for (const row of rows) {
    const baseline = typeof row.baseline === "number" ? row.baseline : null;
    if (baseline === null || !Number.isFinite(baseline) || baseline <= 0) {
      continue;
    }

    const timestamp = new Date(row.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const payload = inflateFeedEntry(row);
    if (!payload) {
      continue;
    }

    const score = computeFinalScore({
      seed,
      key: row.key,
      baseline,
      timestamp,
      now,
    });
    if (!Number.isFinite(score) || score <= 0) {
      continue;
    }

    ranked.push({
      key: row.key,
      score,
      timestamp,
      payload,
    });
  }

  return ranked;
}

function inflateFeedEntry(row: FeedQueryRow): FeedEntry | null {
  const data = asJsonRecord(row.data);
  if (!data) return null;

  switch (row.type) {
    case "article": {
      const id = coerceString(data.id);
      const publishedAt = coerceIsoString(data.publishedAt);
      if (!id || !publishedAt) return null;
      return {
        type: "article",
        id,
        title: coerceString(data.title) ?? "",
        replyCount: coerceNumber(data.replyCount),
        recentReplyCount: coerceNumber(data.recentReplyCount),
        favorCount: coerceNumber(data.favorCount),
        upvote: coerceNumber(data.upvote),
        href: coerceString(data.href) ?? `/a/${id}`,
        author: parseBasicUser(data.author),
        publishedAt,
      } satisfies ArticleFeedEntry;
    }
    case "discussion": {
      const discussionId = typeof data.id === "number" ? data.id : Number.NaN;
      const updatedAt = coerceIsoString(data.updatedAt);
      if (!Number.isFinite(discussionId) || !updatedAt) return null;
      const discussionNumericId = Math.trunc(discussionId);
      const discussionIdStr = discussionNumericId.toString();
      return {
        type: "discussion",
        id: discussionNumericId,
        title: coerceString(data.title) ?? "",
        forum: coerceString(data.forum) ?? "",
        replyCount: coerceNumber(data.replyCount),
        recentReplyCount: coerceNumber(data.recentReplyCount),
        href: coerceString(data.href) ?? `/d/${discussionIdStr}`,
        author: parseBasicUser(data.author),
        updatedAt,
      } satisfies DiscussionFeedEntry;
    }
    case "paste": {
      const id = coerceString(data.id);
      const createdAt = coerceIsoString(data.createdAt);
      if (!id || !createdAt) return null;
      return {
        type: "paste",
        id,
        title: coerceString(data.title) ?? `云剪贴板 ${id}`,
        preview: coerceString(data.preview) ?? "暂无内容",
        isAuthorPrivileged: coerceBoolean(data.isAuthorPrivileged),
        author: parseBasicUser(data.author),
        href: coerceString(data.href) ?? `/p/${id}`,
        createdAt,
      } satisfies PasteFeedEntry;
    }
    case "judgement": {
      const userId = typeof data.userId === "number" ? data.userId : null;
      const createdAt = coerceIsoString(data.createdAt);
      if (userId === null || !createdAt) return null;
      const createdAtDate = new Date(createdAt);
      if (Number.isNaN(createdAtDate.getTime())) return null;
      const anchor = buildJudgementAnchor(createdAtDate, userId);
      const defaultId = `${userId.toString()}-${createdAtDate.getTime().toString()}`;
      return {
        type: "judgement",
        id: coerceString(data.id) ?? defaultId,
        action: coerceString(data.action) ?? "社区裁决",
        reason: coerceString(data.reason) ?? "",
        addedPermission: coerceNumber(data.addedPermission),
        revokedPermission: coerceNumber(data.revokedPermission),
        anchor,
        href: `${coerceString(data.href) ?? "/ostraka"}#${anchor}`,
        user: parseBasicUser(data.user),
        createdAt,
      } satisfies JudgementFeedEntry;
    }
    default:
      return null;
  }
}

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseBasicUser(value: unknown): BasicUserSnapshot | null {
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }

  const id = record.id;
  const name = record.name;
  const color = record.color;
  if (
    typeof id !== "number" ||
    typeof name !== "string" ||
    typeof color !== "string"
  ) {
    return null;
  }

  const badge = record.badge;
  const ccfLevel = typeof record.ccfLevel === "number" ? record.ccfLevel : 0;
  const xcpcLevel = typeof record.xcpcLevel === "number" ? record.xcpcLevel : 0;

  return {
    id,
    name,
    badge: badge === null || typeof badge === "string" ? (badge ?? null) : null,
    color,
    ccfLevel,
    xcpcLevel,
  };
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
}

function coerceIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return null;
  }
  return null;
}

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

function computeDeterministicJitter(seed: string, key: string) {
  const hash = createHash("sha256")
    .update(seed)
    .update(":")
    .update(key)
    .digest();
  const value = hash.readUInt32BE(0) / 0xffffffff;
  return RANDOM_MIN + (RANDOM_MAX - RANDOM_MIN) * value;
}

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

function encodeCursor(payload: FeedCursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function generateSeed() {
  return randomBytes(8).toString("hex");
}

function buildJudgementAnchor(time: Date, userId: number) {
  const timePart = time.getTime().toString(36);
  const userPart = userId.toString(36);
  return `ostrakon-${timePart}-${userPart}`;
}
