import {
  and,
  db,
  eq,
  gte,
  isNotNull,
  notExists,
  schema,
} from "@luogu-discussion-archive/db";

export const VERIFIED_PUBLIC = "public" as const;
export const ANONYMOUS_UPSTREAM = "anonymous_upstream" as const;

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export const VISIBILITY_TTL_MS = boundedInteger(
  "VISIBILITY_TTL_MS",
  7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  90 * 24 * 60 * 60 * 1000,
);

export function visibilityCutoff(now = new Date()) {
  return new Date(now.getTime() - VISIBILITY_TTL_MS);
}

export function canExposeEntity(
  state: string | null | undefined,
  checkedAt: Date | null | undefined,
  source: string | null | undefined,
  now = new Date(),
) {
  return (
    state === VERIFIED_PUBLIC &&
    source === ANONYMOUS_UPSTREAM &&
    checkedAt instanceof Date &&
    checkedAt >= visibilityCutoff(now)
  );
}

export function canExposeSnapshot(
  entity:
    | {
        visibilityState?: string | null;
        visibilityCheckedAt?: Date | null;
        visibilitySource?: string | null;
      }
    | null
    | undefined,
  snapshot:
    | {
        exposureState?: string | null;
        verifiedPublicAt?: Date | null;
        verifiedSource?: string | null;
      }
    | null
    | undefined,
  now = new Date(),
) {
  return (
    canExposeEntity(
      entity?.visibilityState,
      entity?.visibilityCheckedAt,
      entity?.visibilitySource,
      now,
    ) &&
    snapshot?.exposureState === VERIFIED_PUBLIC &&
    snapshot.verifiedSource === ANONYMOUS_UPSTREAM &&
    snapshot.verifiedPublicAt instanceof Date
  );
}

export function publicArticleCondition(now = new Date()) {
  return and(
    eq(schema.Article.public, true),
    eq(schema.Article.visibilityState, VERIFIED_PUBLIC),
    eq(schema.Article.visibilitySource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.Article.visibilityCheckedAt),
    gte(schema.Article.visibilityCheckedAt, visibilityCutoff(now)),
  );
}

export function verifiedArticleSnapshotCondition() {
  return and(
    eq(schema.ArticleSnapshot.exposureState, VERIFIED_PUBLIC),
    eq(schema.ArticleSnapshot.verifiedSource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.ArticleSnapshot.verifiedPublicAt),
  );
}

export function verifiedArticleReplyCondition() {
  return and(
    eq(schema.ArticleReply.exposureState, VERIFIED_PUBLIC),
    eq(schema.ArticleReply.verifiedSource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.ArticleReply.verifiedPublicAt),
  );
}

export function publicPostCondition(now = new Date()) {
  return and(
    eq(schema.Post.public, true),
    eq(schema.Post.visibilityState, VERIFIED_PUBLIC),
    eq(schema.Post.visibilitySource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.Post.visibilityCheckedAt),
    gte(schema.Post.visibilityCheckedAt, visibilityCutoff(now)),
    notExists(
      db
        .select({ postId: schema.PostTakedown.postId })
        .from(schema.PostTakedown)
        .where(eq(schema.PostTakedown.postId, schema.Post.id)),
    ),
  );
}

export function verifiedPostSnapshotCondition() {
  return and(
    eq(schema.PostSnapshot.exposureState, VERIFIED_PUBLIC),
    eq(schema.PostSnapshot.verifiedSource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.PostSnapshot.verifiedPublicAt),
  );
}

export function verifiedReplySnapshotCondition() {
  return and(
    eq(schema.ReplySnapshot.exposureState, VERIFIED_PUBLIC),
    eq(schema.ReplySnapshot.verifiedSource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.ReplySnapshot.verifiedPublicAt),
  );
}

export function publicPasteCondition(now = new Date()) {
  return and(
    eq(schema.Paste.public, true),
    eq(schema.Paste.visibilityState, VERIFIED_PUBLIC),
    eq(schema.Paste.visibilitySource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.Paste.visibilityCheckedAt),
    gte(schema.Paste.visibilityCheckedAt, visibilityCutoff(now)),
  );
}

export function verifiedPasteSnapshotCondition() {
  return and(
    eq(schema.PasteSnapshot.public, true),
    eq(schema.PasteSnapshot.exposureState, VERIFIED_PUBLIC),
    eq(schema.PasteSnapshot.verifiedSource, ANONYMOUS_UPSTREAM),
    isNotNull(schema.PasteSnapshot.verifiedPublicAt),
  );
}
