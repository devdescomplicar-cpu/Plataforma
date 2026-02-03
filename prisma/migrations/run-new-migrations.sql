-- Execute este arquivo uma vez no banco (ex.: psql $DATABASE_URL -f prisma/migrations/run-new-migrations.sql)
-- Depois rode: npx prisma migrate resolve --applied "20250129000000_add_push_subscriptions" --schema=prisma/schema.prisma
-- E: npx prisma migrate resolve --applied "20250129100000_add_notification_templates" --schema=prisma/schema.prisma

-- Migration: 20250129000000_add_push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_accountId_idx" ON "push_subscriptions"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_accountId_endpoint_key" ON "push_subscriptions"("accountId", "endpoint");

CREATE TABLE IF NOT EXISTS "push_notification_logs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetFilter" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_notification_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "push_notification_logs_createdAt_idx" ON "push_notification_logs"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_accountId_fkey'
  ) THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migration: 20250129100000_add_notification_templates
CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "trigger" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "daysOffset" INTEGER,
    "subject" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notification_templates_trigger_idx" ON "notification_templates"("trigger");
CREATE INDEX IF NOT EXISTS "notification_templates_channel_idx" ON "notification_templates"("channel");
CREATE INDEX IF NOT EXISTS "notification_templates_deletedAt_idx" ON "notification_templates"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_trigger_channel_daysOffset_key"
  ON "notification_templates"("trigger", "channel", "daysOffset");

-- Migration: 20250129200000_add_email_sent_count
ALTER TABLE "push_notification_logs" ADD COLUMN IF NOT EXISTS "emailSentCount" INTEGER NOT NULL DEFAULT 0;
