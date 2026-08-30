ALTER TABLE "Paste"
    ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Article"
    ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Post"
    ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "Paste" p
SET "public" = latest."public"
FROM (
    SELECT DISTINCT ON ("pasteId")
        "pasteId", "public"
    FROM "PasteSnapshot"
    ORDER BY "pasteId", "capturedAt" DESC
) latest
WHERE latest."pasteId" = p."id";

UPDATE "Article" a
SET "public" = (latest."status" = 2)
FROM (
    SELECT DISTINCT ON ("articleId")
        "articleId", "status"
    FROM "ArticleSnapshot"
    ORDER BY "articleId", "capturedAt" DESC
) latest
WHERE latest."articleId" = a."lid";

-- Posts have no upstream visibility field in archived snapshots. Every stored
-- post was obtained from a public listing/show endpoint; later 403/404 refreshes
-- revoke this flag in the hardened worker.
UPDATE "Post" SET "public" = TRUE;

CREATE INDEX "Article_public_updatedAt_idx"
    ON "Article"("public", "updatedAt" DESC);
CREATE INDEX "Post_public_updatedAt_idx"
    ON "Post"("public", "updatedAt" DESC);
CREATE INDEX "Paste_public_time_idx"
    ON "Paste"("public", "time" DESC);
