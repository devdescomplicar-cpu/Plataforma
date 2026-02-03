-- Create smtp_configs table for SMTP configuration.
-- Safe: CREATE TABLE IF NOT EXISTS, no data loss.

CREATE TABLE IF NOT EXISTS "smtp_configs" (
  "id" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL DEFAULT 587,
  "secure" BOOLEAN NOT NULL DEFAULT false,
  "user" TEXT,
  "passEncrypted" TEXT,
  "fromEmail" TEXT NOT NULL,
  "fromName" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "smtp_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "smtp_configs_active_idx" ON "smtp_configs"("active");
CREATE INDEX IF NOT EXISTS "smtp_configs_deletedAt_idx" ON "smtp_configs"("deletedAt");
