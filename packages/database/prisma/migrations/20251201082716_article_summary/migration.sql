-- CreateTable
CREATE TABLE "ArticleCopra" (
    "articleId" TEXT NOT NULL,
    "summary" TEXT,
    "tags" JSONB,

    CONSTRAINT "ArticleCopra_pkey" PRIMARY KEY ("articleId")
);

-- AddForeignKey
ALTER TABLE "ArticleCopra" ADD CONSTRAINT "ArticleCopra_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("lid") ON DELETE RESTRICT ON UPDATE CASCADE;
