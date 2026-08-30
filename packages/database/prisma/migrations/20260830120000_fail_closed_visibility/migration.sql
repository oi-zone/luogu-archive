-- Correct the earlier fail-open visibility backfill without rewriting an
-- already-applied migration. Legacy authenticated-crawler provenance cannot be
-- reconstructed, so every legacy body starts unverified.

ALTER TABLE "Article"
  ADD COLUMN "visibilityState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "visibilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "visibilitySource" TEXT,
  ADD COLUMN "visibilityVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Post"
  ADD COLUMN "visibilityState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "visibilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "visibilitySource" TEXT,
  ADD COLUMN "visibilityVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Paste"
  ADD COLUMN "visibilityState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "visibilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "visibilitySource" TEXT,
  ADD COLUMN "visibilityVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ArticleSnapshot"
  ADD COLUMN "exposureState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "verifiedPublicAt" TIMESTAMP(3),
  ADD COLUMN "verifiedSource" TEXT;

ALTER TABLE "PostSnapshot"
  ADD COLUMN "exposureState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "verifiedPublicAt" TIMESTAMP(3),
  ADD COLUMN "verifiedSource" TEXT;

ALTER TABLE "ReplySnapshot"
  ADD COLUMN "exposureState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "verifiedPublicAt" TIMESTAMP(3),
  ADD COLUMN "verifiedSource" TEXT;

ALTER TABLE "ArticleReply"
  ADD COLUMN "exposureState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "verifiedPublicAt" TIMESTAMP(3),
  ADD COLUMN "verifiedSource" TEXT;

ALTER TABLE "PasteSnapshot"
  ADD COLUMN "exposureState" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "verifiedPublicAt" TIMESTAMP(3),
  ADD COLUMN "verifiedSource" TEXT;

-- Revoke the previous inferred Article/Post publication flags. Only a later
-- successful anonymous request may promote either entity and its exact body.
UPDATE "Article" SET "public" = FALSE;
UPDATE "Post" SET "public" = FALSE;

-- PasteSnapshot.public is retained only as limited current-state evidence. It
-- does not verify any stored body; all PasteSnapshot exposureState values stay
-- unverified until an anonymous detail fetch succeeds.
UPDATE "Paste" p
SET
  "visibilityState" = CASE WHEN latest."public" THEN 'public' ELSE 'restricted' END,
  "visibilityCheckedAt" = latest."lastSeenAt",
  "visibilitySource" = 'legacy_paste_snapshot',
  "public" = latest."public"
FROM (
  SELECT DISTINCT ON ("pasteId")
    "pasteId", "public", "lastSeenAt"
  FROM "PasteSnapshot"
  ORDER BY "pasteId", "capturedAt" DESC
) latest
WHERE latest."pasteId" = p."id";

ALTER TABLE "Article"
  ADD CONSTRAINT "Article_visibility_state_check"
    CHECK ("visibilityState" IN ('unverified', 'public', 'restricted')),
  ADD CONSTRAINT "Article_visibility_version_check" CHECK ("visibilityVersion" > 0);
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_visibility_state_check"
    CHECK ("visibilityState" IN ('unverified', 'public', 'restricted')),
  ADD CONSTRAINT "Post_visibility_version_check" CHECK ("visibilityVersion" > 0);
ALTER TABLE "Paste"
  ADD CONSTRAINT "Paste_visibility_state_check"
    CHECK ("visibilityState" IN ('unverified', 'public', 'restricted')),
  ADD CONSTRAINT "Paste_visibility_version_check" CHECK ("visibilityVersion" > 0);

ALTER TABLE "ArticleSnapshot"
  ADD CONSTRAINT "ArticleSnapshot_exposure_state_check"
    CHECK ("exposureState" IN ('unverified', 'public', 'restricted'));
ALTER TABLE "PostSnapshot"
  ADD CONSTRAINT "PostSnapshot_exposure_state_check"
    CHECK ("exposureState" IN ('unverified', 'public', 'restricted'));
ALTER TABLE "ReplySnapshot"
  ADD CONSTRAINT "ReplySnapshot_exposure_state_check"
    CHECK ("exposureState" IN ('unverified', 'public', 'restricted'));
ALTER TABLE "ArticleReply"
  ADD CONSTRAINT "ArticleReply_exposure_state_check"
    CHECK ("exposureState" IN ('unverified', 'public', 'restricted'));
ALTER TABLE "PasteSnapshot"
  ADD CONSTRAINT "PasteSnapshot_exposure_state_check"
    CHECK ("exposureState" IN ('unverified', 'public', 'restricted'));

CREATE INDEX "Article_visibility_revalidation_idx"
  ON "Article"("visibilityCheckedAt", "lid");
CREATE INDEX "Post_visibility_revalidation_idx"
  ON "Post"("visibilityCheckedAt", "id");
CREATE INDEX "Paste_visibility_revalidation_idx"
  ON "Paste"("visibilityCheckedAt", "id");
CREATE INDEX "ArticleSnapshot_exposure_idx"
  ON "ArticleSnapshot"("articleId", "exposureState", "capturedAt" DESC);
CREATE INDEX "PostSnapshot_exposure_idx"
  ON "PostSnapshot"("postId", "exposureState", "capturedAt" DESC);
CREATE INDEX "ReplySnapshot_exposure_idx"
  ON "ReplySnapshot"("replyId", "exposureState", "capturedAt" DESC);

CREATE TABLE "VisibilityScanState" (
  "entityType" TEXT NOT NULL,
  "afterId" TEXT,
  "cycle" INTEGER NOT NULL DEFAULT 1,
  "lastCompletedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VisibilityScanState_pkey" PRIMARY KEY ("entityType"),
  CONSTRAINT "VisibilityScanState_entity_type_check"
    CHECK ("entityType" IN ('article', 'discussion', 'paste')),
  CONSTRAINT "VisibilityScanState_after_id_check"
    CHECK ("afterId" IS NULL OR length("afterId") BETWEEN 1 AND 128),
  CONSTRAINT "VisibilityScanState_cycle_check" CHECK ("cycle" > 0)
);
