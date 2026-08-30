import {
  and,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gt,
  lt,
  or,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import type { BasicUserSnapshot } from "./types.js";

const OSTRAKA_PAGE_DEFAULT_LIMIT = 50;
const OSTRAKA_PAGE_MAX_LIMIT = 200;
const OSTRAKA_CURSOR_SEPARATOR = "-";
const OSTRAKA_ANCHOR_PREFIX = "ostrakon-";
const OSTRAKA_RECENT_WINDOW_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OstrakonEntry {
  id: string;
  cursor: string;
  anchor: string;
  createdAt: string;
  reason: string;
  addedPermission: number;
  revokedPermission: number;
  hasAddedPermission: boolean;
  hasRevokedPermission: boolean;
  user: BasicUserSnapshot | null;
}

export interface OstrakonPage {
  entries: OstrakonEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface OstrakonStat {
  totalJudgements: number;
  judgedUsers: number;
  recentJudgements: number;
}

export interface OstrakonCursor {
  time: Date;
  userId: number;
}

export async function getGlobalOstrakonPage(options?: {
  cursor?: OstrakonCursor | null;
  limit?: number;
}): Promise<OstrakonPage> {
  const requestedLimit = options?.limit ?? OSTRAKA_PAGE_DEFAULT_LIMIT;
  const clampedLimit = Math.min(
    Math.max(1, requestedLimit),
    OSTRAKA_PAGE_MAX_LIMIT,
  );

  const take = clampedLimit + 1;
  const cursor = options?.cursor ?? null;
  const cursorCondition = cursor
    ? or(
        lt(schema.Judgement.time, cursor.time),
        and(
          eq(schema.Judgement.time, cursor.time),
          lt(schema.Judgement.userId, cursor.userId),
        ),
      )
    : undefined;

  const judgements = await db
    .select({
      time: schema.Judgement.time,
      userId: schema.Judgement.userId,
      reason: schema.Judgement.reason,
      addedPermission: schema.Judgement.addedPermission,
      revokedPermission: schema.Judgement.revokedPermission,
    })
    .from(schema.Judgement)
    .where(cursorCondition)
    .orderBy(desc(schema.Judgement.time), desc(schema.Judgement.userId))
    .limit(take);

  const userIds = Array.from(new Set(judgements.map((item) => item.userId)));
  const snapshots = userIds.length
    ? (
        await db.execute<{
          userId: number;
          name: string;
          badge: string | null;
          color: (typeof schema.Color.enumValues)[number];
          ccfLevel: number;
          xcpcLevel: number;
        }>(sql`
          SELECT DISTINCT ON ("userId")
            "userId", "name", "badge", "color", "ccfLevel", "xcpcLevel"
          FROM "UserSnapshot"
          WHERE "userId" = ANY(${userIds})
          ORDER BY "userId", "capturedAt" DESC
        `)
      ).rows
    : [];

  const snapshotMap = new Map(
    snapshots.map((snapshot) => [snapshot.userId, snapshot] as const),
  );

  const entries = judgements.slice(0, clampedLimit).map((judgement) => {
    const cursorValue = encodeOstrakonCursor(judgement.time, judgement.userId);
    const userSnapshot = snapshotMap.get(judgement.userId);
    const user: BasicUserSnapshot | null = userSnapshot
      ? {
          id: judgement.userId,
          name: userSnapshot.name,
          badge: userSnapshot.badge ?? null,
          color: userSnapshot.color,
          ccfLevel: userSnapshot.ccfLevel,
          xcpcLevel: userSnapshot.xcpcLevel,
        }
      : null;

    const hasAddedPermission = Boolean(judgement.addedPermission);
    const hasRevokedPermission = Boolean(judgement.revokedPermission);

    return {
      id: `${OSTRAKA_ANCHOR_PREFIX}${cursorValue}`,
      cursor: cursorValue,
      anchor: `${OSTRAKA_ANCHOR_PREFIX}${cursorValue}`,
      createdAt: judgement.time.toISOString(),
      reason: judgement.reason,
      addedPermission: judgement.addedPermission,
      revokedPermission: judgement.revokedPermission,
      hasAddedPermission,
      hasRevokedPermission,
      user,
    } satisfies OstrakonEntry;
  });

  const hasMore = judgements.length > clampedLimit;
  const nextCursor =
    hasMore && judgements[clampedLimit]
      ? encodeOstrakonCursor(
          judgements[clampedLimit].time,
          judgements[clampedLimit].userId,
        )
      : null;

  return {
    entries,
    hasMore,
    nextCursor,
  };
}

export function parseOstrakonCursor(cursor: string): OstrakonCursor | null {
  if (!cursor) {
    return null;
  }

  const separatorIndex = cursor.lastIndexOf(OSTRAKA_CURSOR_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) {
    return null;
  }

  const timestampPart = cursor.slice(0, separatorIndex);
  const userIdPart = cursor.slice(separatorIndex + 1);
  if (
    !/^[0-9a-z]{1,16}$/.test(timestampPart) ||
    !/^[0-9a-z]{1,8}$/.test(userIdPart)
  ) {
    return null;
  }

  const millis = Number.parseInt(timestampPart, 36);
  const userId = Number.parseInt(userIdPart, 36);

  if (
    !Number.isSafeInteger(millis) ||
    millis <= 0 ||
    Number.isNaN(new Date(millis).getTime())
  ) {
    return null;
  }

  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2_147_483_647) {
    return null;
  }

  return {
    time: new Date(millis),
    userId,
  } satisfies OstrakonCursor;
}

export function formatOstrakonAnchor(cursor: string) {
  return `${OSTRAKA_ANCHOR_PREFIX}${cursor}`;
}

function encodeOstrakonCursor(time: Date, userId: number) {
  const millis = time.getTime().toString(36);
  const userPart = userId.toString(36);
  return `${millis}${OSTRAKA_CURSOR_SEPARATOR}${userPart}`;
}

export async function getOstrakonStat(): Promise<OstrakonStat> {
  const recentThreshold = new Date(
    Date.now() - OSTRAKA_RECENT_WINDOW_DAYS * MS_PER_DAY,
  );

  const [totalRows, judgedUserRows, recentRows] = await Promise.all([
    db.select({ total: count() }).from(schema.Judgement),
    db
      .select({ total: countDistinct(schema.Judgement.userId) })
      .from(schema.Judgement),
    db
      .select({ total: count() })
      .from(schema.Judgement)
      .where(gt(schema.Judgement.time, recentThreshold)),
  ]);

  return {
    totalJudgements: totalRows[0]?.total ?? 0,
    judgedUsers: judgedUserRows[0]?.total ?? 0,
    recentJudgements: recentRows[0]?.total ?? 0,
  } satisfies OstrakonStat;
}
