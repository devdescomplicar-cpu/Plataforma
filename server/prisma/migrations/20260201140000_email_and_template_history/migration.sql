-- Histórico de e-mails enviados (SMTP)
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "origin" TEXT,
  "templateId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_logs_sentAt_idx" ON "email_logs"("sentAt");
CREATE INDEX IF NOT EXISTS "email_logs_origin_idx" ON "email_logs"("origin");

-- Coluna opcional para falhas em push (histórico detalhado)
ALTER TABLE "push_notification_logs" ADD COLUMN IF NOT EXISTS "failedCount" INTEGER NOT NULL DEFAULT 0;

-- Histórico de uso de gatilhos (templates)
CREATE TABLE IF NOT EXISTS "notification_template_usage_logs" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipientInfo" TEXT,
  "success" BOOLEAN NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_template_usage_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_template_usage_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "notification_template_usage_logs_templateId_idx" ON "notification_template_usage_logs"("templateId");
CREATE INDEX IF NOT EXISTS "notification_template_usage_logs_trigger_idx" ON "notification_template_usage_logs"("trigger");
CREATE INDEX IF NOT EXISTS "notification_template_usage_logs_createdAt_idx" ON "notification_template_usage_logs"("createdAt");
