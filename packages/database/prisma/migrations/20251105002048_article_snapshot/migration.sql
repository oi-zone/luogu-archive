/*
  Warnings:

  - You are about to drop the column `adminNote` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `collectionId` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `promoteStatus` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `solutionForPid` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Article` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `promoteStatus` to the `ArticleSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `ArticleSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Article" DROP CONSTRAINT "Article_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Article" DROP CONSTRAINT "Article_solutionForPid_fkey";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "adminNote",
DROP COLUMN "collectionId",
DROP COLUMN "promoteStatus",
DROP COLUMN "solutionForPid",
DROP COLUMN "status",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ArticleSnapshot" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "collectionId" INTEGER,
ADD COLUMN     "promoteStatus" INTEGER NOT NULL,
ADD COLUMN     "solutionForPid" TEXT,
ADD COLUMN     "status" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ArticleSnapshot" ADD CONSTRAINT "ArticleSnapshot_solutionForPid_fkey" FOREIGN KEY ("solutionForPid") REFERENCES "Problem"("pid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSnapshot" ADD CONSTRAINT "ArticleSnapshot_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ArticleCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
