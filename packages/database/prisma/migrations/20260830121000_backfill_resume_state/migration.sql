CREATE TABLE "BackfillResumeState" (
  "name" TEXT NOT NULL,
  "afterUpdatedAt" TIMESTAMP(3),
  "afterEntityType" TEXT,
  "afterEntityId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BackfillResumeState_pkey" PRIMARY KEY ("name"),
  CONSTRAINT "BackfillResumeState_name_check" CHECK ("name" = 'pending'),
  CONSTRAINT "BackfillResumeState_cursor_check" CHECK (
    ("afterUpdatedAt" IS NULL AND "afterEntityType" IS NULL AND "afterEntityId" IS NULL)
    OR
    ("afterUpdatedAt" IS NOT NULL AND "afterEntityType" IS NOT NULL AND "afterEntityId" IS NOT NULL)
  )
);
