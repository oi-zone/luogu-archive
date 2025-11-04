/*
  Warnings:

  - A unique constraint covering the columns `[problemId]` on the table `Forum` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Forum" ADD COLUMN     "problemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Forum_problemId_key" ON "Forum"("problemId");

-- AddForeignKey
ALTER TABLE "Forum" ADD CONSTRAINT "Forum_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("pid") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: set problemId to slug when a Problem with the same pid exists.
UPDATE "Forum" f
SET "problemId" = p."pid"
FROM "Problem" p
WHERE f."slug" = p."pid";
