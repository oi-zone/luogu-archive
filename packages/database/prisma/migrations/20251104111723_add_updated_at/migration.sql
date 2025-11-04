/*
  Warnings:

  - Added the required column `updatedAt` to the `Problem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Post"
    ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "topped" BOOLEAN NOT NULL DEFAULT false,
    -- Before making updatedAt NOT NULL, populate it from snapshots (latest lastSeenAt per post).
    -- If a post has no snapshots, fall back to the post's original time.
    ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Populate Post.updatedAt from PostSnapshot.lastSeenAt (latest per post)
UPDATE "Post"
SET "updatedAt" = s.max_lastseen
FROM (
    SELECT "postId", MAX("lastSeenAt") AS max_lastseen
    FROM "PostSnapshot"
    GROUP BY "postId"
) s
WHERE "Post"."id" = s."postId";

-- AlterTable: now enforce all constraints
ALTER TABLE "Post"
    ALTER COLUMN "locked" DROP DEFAULT,
    ALTER COLUMN "topped" DROP DEFAULT,
    ALTER COLUMN "updatedAt" SET NOT NULL;


-- AlterTable: add Forum.updatedAt as nullable first
ALTER TABLE "Forum" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Populate Forum.updatedAt as the latest Post.updatedAt among posts that have snapshots in the forum.
-- This uses Post.updatedAt (which we populated above) and associates posts to forums via PostSnapshot.forumSlug.
UPDATE "Forum"
SET "updatedAt" = f.max_updated
FROM (
    SELECT ps."forumSlug" AS forumSlug, MAX(p."updatedAt") AS max_updated
    FROM "Post" p
    JOIN "PostSnapshot" ps ON ps."postId" = p."id"
    GROUP BY ps."forumSlug"
) f
WHERE "Forum"."slug" = f.forumSlug;

-- Now enforce NOT NULL
ALTER TABLE "Forum" ALTER COLUMN "updatedAt" SET NOT NULL;


-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
