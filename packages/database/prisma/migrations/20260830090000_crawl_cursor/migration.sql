CREATE TABLE "CrawlCursor" (
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'older',
    "nextCursor" TEXT,
    "status" TEXT NOT NULL,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "CrawlCursor_pkey" PRIMARY KEY ("entityType", "entityId"),
    CONSTRAINT "CrawlCursor_entity_type_check" CHECK ("entityType" IN ('discussionReplies', 'articleReplies')),
    CONSTRAINT "CrawlCursor_entity_id_check" CHECK (length("entityId") BETWEEN 1 AND 128),
    CONSTRAINT "CrawlCursor_direction_check" CHECK ("direction" = 'older'),
    CONSTRAINT "CrawlCursor_next_cursor_check" CHECK ("nextCursor" IS NULL OR length("nextCursor") BETWEEN 1 AND 128),
    CONSTRAINT "CrawlCursor_status_check" CHECK ("status" IN ('pending', 'active', 'completed', 'paused')),
    CONSTRAINT "CrawlCursor_pages_processed_check" CHECK ("pagesProcessed" >= 0),
    CONSTRAINT "CrawlCursor_version_check" CHECK ("version" > 0),
    CONSTRAINT "CrawlCursor_last_error_check" CHECK ("lastError" IS NULL OR length("lastError") <= 512)
);

CREATE INDEX "CrawlCursor_status_updatedAt_idx"
    ON "CrawlCursor"("status", "updatedAt");
