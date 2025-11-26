/*
  Warnings:

  - You are about to drop the column `locked` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `topped` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post"
  DROP COLUMN "topped",
  DROP COLUMN "locked";

-- AlterTable
ALTER TABLE "PostSnapshot"
  ADD COLUMN     "topped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "pinnedReplyId" INTEGER;

ALTER TABLE "PostSnapshot"
  ALTER COLUMN "topped" DROP DEFAULT,
  ALTER COLUMN "locked" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "PostSnapshot_pinnedReplyId_key" ON "PostSnapshot"("pinnedReplyId");

-- AddForeignKey
ALTER TABLE "PostSnapshot" ADD CONSTRAINT "PostSnapshot_pinnedReplyId_fkey" FOREIGN KEY ("pinnedReplyId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
