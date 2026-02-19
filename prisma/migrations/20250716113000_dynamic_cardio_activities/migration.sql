-- Create new table for user-defined cardio activities
CREATE TABLE "CardioActivityEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "CardioActivityEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardioActivityEntry_userId_name_key" ON "CardioActivityEntry"("userId", "name");

ALTER TABLE "CardioActivityEntry"
    ADD CONSTRAINT "CardioActivityEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new FK column to sessions
ALTER TABLE "CardioSession"
    ADD COLUMN "activityId" TEXT;

-- Seed the new table with existing enum entries (lowercased for consistency)
INSERT INTO "CardioActivityEntry" ("id", "userId", "name")
SELECT DISTINCT md5("userId" || ':' || LOWER("activity"::text)), "userId", LOWER("activity"::text)
FROM "CardioSession";

-- Attach sessions to the newly created activities
UPDATE "CardioSession" cs
SET "activityId" = cae."id"
FROM "CardioActivityEntry" cae
WHERE cae."userId" = cs."userId"
  AND cae."name" = LOWER(cs."activity"::text);

ALTER TABLE "CardioSession"
    ALTER COLUMN "activityId" SET NOT NULL;

-- Drop old index/column/enum
DROP INDEX IF EXISTS "CardioSession_userId_activity_date_idx";
ALTER TABLE "CardioSession" DROP COLUMN "activity";
DROP TYPE IF EXISTS "CardioActivity";

-- Add new FK + index
ALTER TABLE "CardioSession"
    ADD CONSTRAINT "CardioSession_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "CardioActivityEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CardioSession_userId_activityId_date_idx"
    ON "CardioSession"("userId", "activityId", "date");
