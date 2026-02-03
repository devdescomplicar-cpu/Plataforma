-- Plans: add missing columns (maxVehicles, maxStorageMb) and duration (durationType, durationMonths).
-- Safe: ADD COLUMN IF NOT EXISTS, no data loss.

-- Ensure plans table exists (minimal structure if created elsewhere with fewer columns)
CREATE TABLE IF NOT EXISTS "plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "features" TEXT[] NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- Add columns if missing (idempotent)
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxVehicles" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxStorageMb" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "durationType" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER;

-- Default existing rows to monthly
UPDATE "plans"
SET "durationType" = COALESCE("durationType", 'monthly'),
    "durationMonths" = COALESCE("durationMonths", 1)
WHERE "durationType" IS NULL OR "durationMonths" IS NULL;

-- Index for listing by duration
CREATE INDEX IF NOT EXISTS "plans_durationType_idx" ON "plans"("durationType");
CREATE INDEX IF NOT EXISTS "plans_active_idx" ON "plans"("active");
CREATE INDEX IF NOT EXISTS "plans_deletedAt_idx" ON "plans"("deletedAt");
