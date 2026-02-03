-- Add column to store whether this log entry was processed in test mode (so UI shows correct badge)
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "processedInTestMode" BOOLEAN NOT NULL DEFAULT true;
