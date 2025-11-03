/*
    Migration notes (updated):

    - The migration renames some existing columns instead of dropping/adding them so their data is preserved:
        - `Judgement.permissionGranted` -> `Judgement.addedPermission` (renamed)
        - `Judgement.permissionRevoked` -> `Judgement.revokedPermission` (renamed)
        - Snapshot `time` -> `capturedAt` and `until` -> `lastSeenAt` for: `PasteSnapshot`, `PostSnapshot`, `ReplySnapshot`, `UserSnapshot` (renamed). Note: `PasteSnapshot` timestamps use TIMESTAMP(0) precision.

    - `Reply.authorId` is added to the `Reply` table and will be NOT NULL in the final schema. The migration temporarily creates the column, populates it from the most-recent `ReplySnapshot.authorId` per reply, then sets it to NOT NULL so the final state never leaves it nullable.
    - `ReplySnapshot.authorId` is dropped after its values are copied to `Reply.authorId`.

    - The `User.updatedAt` column is dropped by this migration; that data will be lost.

    - Primary key changes: the primary keys for `PasteSnapshot`, `PostSnapshot`, `ReplySnapshot`, and `UserSnapshot` are changed to include `capturedAt`. If the migration partially fails, a table could be left without a primary key constraint.

    - New NOT NULL columns without defaults:
        - `UserSnapshot.background`, `UserSnapshot.slogan`, `UserSnapshot.xcpcLevel` are added as NOT NULL. For existing rows the migration will set `background` and `slogan` to empty strings and `xcpcLevel` to 0; the migration removes the temporary DEFAULTs afterwards so the final schema has no defaults.

    - `UserSnapshot.isRoot` will be made NOT NULL. Before altering the column the migration will set any existing NULLs to FALSE to avoid constraint failures.

    - The migration uses Postgres-specific SQL (DISTINCT ON) when copying snapshot authorIds into `Reply.authorId`.

    - If you need strict cross-DB compatibility or different nullability/type changes, review the ALTERs that follow and adapt as needed.

*/
-- DropForeignKey
ALTER TABLE "public"."ReplySnapshot" DROP CONSTRAINT "ReplySnapshot_authorId_fkey";

-- DropIndex
DROP INDEX "public"."PasteSnapshot_pasteId_time_idx";

-- DropIndex
DROP INDEX "public"."PostSnapshot_postId_time_idx";

-- DropIndex
DROP INDEX "public"."ReplySnapshot_authorId_idx";

-- DropIndex
DROP INDEX "public"."ReplySnapshot_replyId_time_idx";

-- DropIndex
DROP INDEX "public"."UserSnapshot_userId_time_idx";

-- AlterTable
-- Rename permission columns to preserve existing data
ALTER TABLE "Judgement" RENAME COLUMN "permissionGranted" TO "addedPermission";
ALTER TABLE "Judgement" RENAME COLUMN "permissionRevoked" TO "revokedPermission";

-- AlterTable
-- Rename snapshot time/until columns to capturedAt/lastSeenAt and update PK
ALTER TABLE "PasteSnapshot" DROP CONSTRAINT "PasteSnapshot_pkey";
ALTER TABLE "PasteSnapshot" ALTER COLUMN "time" DROP DEFAULT;
ALTER TABLE "PasteSnapshot" RENAME COLUMN "time" TO "capturedAt";
ALTER TABLE "PasteSnapshot" RENAME COLUMN "until" TO "lastSeenAt";
ALTER TABLE "PasteSnapshot" ADD CONSTRAINT "PasteSnapshot_pkey" PRIMARY KEY ("pasteId", "capturedAt");

-- Ensure PasteSnapshot timestamp precision matches Prisma model (TIMESTAMP(0)).
ALTER TABLE "PasteSnapshot"
    ALTER COLUMN "capturedAt" TYPE TIMESTAMP(0) USING "capturedAt"::timestamp(0),
    ALTER COLUMN "lastSeenAt" TYPE TIMESTAMP(0) USING "lastSeenAt"::timestamp(0);

-- AlterTable
-- Rename snapshot time/until columns to capturedAt/lastSeenAt and update PK
ALTER TABLE "PostSnapshot" DROP CONSTRAINT "PostSnapshot_pkey";
ALTER TABLE "PostSnapshot" ALTER COLUMN "time" DROP DEFAULT;
ALTER TABLE "PostSnapshot" RENAME COLUMN "time" TO "capturedAt";
ALTER TABLE "PostSnapshot" RENAME COLUMN "until" TO "lastSeenAt";
ALTER TABLE "PostSnapshot" ADD CONSTRAINT "PostSnapshot_pkey" PRIMARY KEY ("postId", "capturedAt");

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "authorId" INTEGER;

-- Populate Reply.authorId from the most-recent ReplySnapshot.authorId to avoid data loss.
-- Use DISTINCT ON to pick the latest snapshot per reply (Postgres-specific).
UPDATE "Reply" r
SET "authorId" = s."authorId"
FROM (
    SELECT DISTINCT ON ("replyId") "replyId", "authorId"
    FROM "ReplySnapshot"
    ORDER BY "replyId", "time" DESC
) AS s
WHERE s."replyId" = r."id";

-- Make the column required after data has been migrated.
ALTER TABLE "Reply" ALTER COLUMN "authorId" SET NOT NULL;

-- AlterTable
-- Remove authorId from snapshots, rename time/until to capturedAt/lastSeenAt, and update PK
ALTER TABLE "ReplySnapshot" DROP COLUMN "authorId";
ALTER TABLE "ReplySnapshot" DROP CONSTRAINT "ReplySnapshot_pkey";
ALTER TABLE "ReplySnapshot" ALTER COLUMN "time" DROP DEFAULT;
ALTER TABLE "ReplySnapshot" RENAME COLUMN "time" TO "capturedAt";
ALTER TABLE "ReplySnapshot" RENAME COLUMN "until" TO "lastSeenAt";
ALTER TABLE "ReplySnapshot" ADD CONSTRAINT "ReplySnapshot_pkey" PRIMARY KEY ("replyId", "capturedAt");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt";

-- AlterTable
-- Rename snapshot time/until columns to capturedAt/lastSeenAt, add new user-snapshot fields, and update PK
ALTER TABLE "UserSnapshot" DROP CONSTRAINT "UserSnapshot_pkey";
ALTER TABLE "UserSnapshot" ALTER COLUMN "time" DROP DEFAULT;
ALTER TABLE "UserSnapshot" RENAME COLUMN "time" TO "capturedAt";
ALTER TABLE "UserSnapshot" RENAME COLUMN "until" TO "lastSeenAt";
ALTER TABLE "UserSnapshot" ADD CONSTRAINT "UserSnapshot_pkey" PRIMARY KEY ("userId", "capturedAt");
ALTER TABLE "UserSnapshot"
    ADD COLUMN     "background" TEXT DEFAULT '' NOT NULL,
    ADD COLUMN     "slogan" TEXT DEFAULT '' NOT NULL,
    ADD COLUMN     "xcpcLevel" INTEGER DEFAULT 0 NOT NULL;
-- Remove temporary defaults for new UserSnapshot columns so final schema has no defaults
ALTER TABLE "UserSnapshot"
    ALTER COLUMN "background" DROP DEFAULT,
    ALTER COLUMN "slogan" DROP DEFAULT,
    ALTER COLUMN "xcpcLevel" DROP DEFAULT;
-- Set any NULL isRoot values to FALSE before making the column NOT NULL
UPDATE "UserSnapshot" SET "isRoot" = FALSE WHERE "isRoot" IS NULL;
ALTER TABLE "UserSnapshot" ALTER COLUMN "isRoot" SET NOT NULL;

-- CreateTable
CREATE TABLE "Article" (
    "lid" CHAR(8) NOT NULL,
    "time" TIMESTAMP(0) NOT NULL,
    "authorId" INTEGER NOT NULL,
    "upvote" INTEGER NOT NULL,
    "replyCount" INTEGER NOT NULL,
    "favorCount" INTEGER NOT NULL,
    "status" INTEGER NOT NULL,
    "solutionForPid" TEXT,
    "promoteStatus" INTEGER NOT NULL,
    "collectionId" INTEGER,
    "adminNote" TEXT,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("lid")
);

-- CreateTable
CREATE TABLE "ArticleSnapshot" (
    "articleId" CHAR(8) NOT NULL,
    "title" TEXT NOT NULL,
    "category" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleSnapshot_pkey" PRIMARY KEY ("articleId","capturedAt")
);

-- CreateTable
CREATE TABLE "ArticleCollection" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ArticleCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleReply" (
    "id" INTEGER NOT NULL,
    "articleId" CHAR(8) NOT NULL,
    "authorId" INTEGER NOT NULL,
    "time" TIMESTAMP(0) NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "pid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" INTEGER,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("pid")
);

-- CreateIndex
CREATE INDEX "Article_time_idx" ON "Article"("time");

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- CreateIndex
CREATE INDEX "Article_upvote_idx" ON "Article"("upvote" DESC);

-- CreateIndex
CREATE INDEX "Article_replyCount_idx" ON "Article"("replyCount" DESC);

-- CreateIndex
CREATE INDEX "Article_favorCount_idx" ON "Article"("favorCount" DESC);

-- CreateIndex
CREATE INDEX "ArticleSnapshot_articleId_idx" ON "ArticleSnapshot"("articleId");

-- CreateIndex
CREATE INDEX "ArticleSnapshot_articleId_capturedAt_idx" ON "ArticleSnapshot"("articleId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "ArticleReply_articleId_idx" ON "ArticleReply"("articleId");

-- CreateIndex
CREATE INDEX "ArticleReply_authorId_idx" ON "ArticleReply"("authorId");

-- CreateIndex
CREATE INDEX "ArticleReply_time_idx" ON "ArticleReply"("time");

-- CreateIndex
CREATE INDEX "PasteSnapshot_pasteId_capturedAt_idx" ON "PasteSnapshot"("pasteId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "PostSnapshot_postId_capturedAt_idx" ON "PostSnapshot"("postId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "Reply_authorId_idx" ON "Reply"("authorId");

-- CreateIndex
CREATE INDEX "ReplySnapshot_replyId_capturedAt_idx" ON "ReplySnapshot"("replyId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "UserSnapshot_userId_capturedAt_idx" ON "UserSnapshot"("userId", "capturedAt" DESC);

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_solutionForPid_fkey" FOREIGN KEY ("solutionForPid") REFERENCES "Problem"("pid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ArticleCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSnapshot" ADD CONSTRAINT "ArticleSnapshot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("lid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleReply" ADD CONSTRAINT "ArticleReply_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("lid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleReply" ADD CONSTRAINT "ArticleReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
