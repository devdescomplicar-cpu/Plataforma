-- AlterTable: add emailSentCount to push_notification_logs (for multi-channel send log)
ALTER TABLE "push_notification_logs" ADD COLUMN IF NOT EXISTS "emailSentCount" INTEGER NOT NULL DEFAULT 0;
