-- AlterTable: vehicle_images - sizeBytes (opcional) e deletedAt (soft delete para limpeza)
ALTER TABLE "vehicle_images" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
ALTER TABLE "vehicle_images" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "vehicle_images_deletedAt_idx" ON "vehicle_images"("deletedAt");

-- CreateTable: storage_snapshots (crescimento no tempo)
CREATE TABLE IF NOT EXISTS "storage_snapshots" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "storage_snapshots_snapshotDate_key" ON "storage_snapshots"("snapshotDate");
CREATE INDEX IF NOT EXISTS "storage_snapshots_snapshotDate_idx" ON "storage_snapshots"("snapshotDate");

-- CreateTable: storage_cleanup_logs (histórico de limpezas)
CREATE TABLE IF NOT EXISTS "storage_cleanup_logs" (
    "id" TEXT NOT NULL,
    "cleanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filesRemoved" INTEGER NOT NULL DEFAULT 0,
    "bytesFreed" BIGINT NOT NULL DEFAULT 0,
    "triggerUserId" TEXT,
    "triggerType" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_cleanup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "storage_cleanup_logs_cleanedAt_idx" ON "storage_cleanup_logs"("cleanedAt");
