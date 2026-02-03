-- Ensure webhook tables exist (repair: migration may have been marked applied without creating tables)
-- Safe: CREATE TABLE IF NOT EXISTS, no DROP, no data loss

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "serverUrl" TEXT NOT NULL DEFAULT 'http://localhost:3001/api/webhooks/receive/',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "testMode" BOOLEAN NOT NULL DEFAULT true,
  "lastTestPayload" JSONB,
  "actions" JSONB NOT NULL DEFAULT '[]',
  "secret" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "webhooks_userId_idx" ON "webhooks"("userId");
CREATE INDEX IF NOT EXISTS "webhooks_isActive_idx" ON "webhooks"("isActive");
CREATE INDEX IF NOT EXISTS "webhooks_deletedAt_idx" ON "webhooks"("deletedAt");

CREATE TABLE IF NOT EXISTS "webhook_field_mappings" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "webhookField" TEXT NOT NULL,
  "systemField" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "prefix" TEXT,
  "suffix" TEXT,
  CONSTRAINT "webhook_field_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_field_mappings_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "webhook_field_mappings_webhookId_webhookField_key" UNIQUE ("webhookId", "webhookField")
);
CREATE INDEX IF NOT EXISTS "webhook_field_mappings_webhookId_idx" ON "webhook_field_mappings"("webhookId");

CREATE TABLE IF NOT EXISTS "webhook_logs" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "headers" JSONB NOT NULL DEFAULT '{}',
  "body" JSONB NOT NULL DEFAULT '{}',
  "statusCode" INTEGER,
  "response" JSONB,
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_logs_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "webhook_logs_webhookId_idx" ON "webhook_logs"("webhookId");
CREATE INDEX IF NOT EXISTS "webhook_logs_receivedAt_idx" ON "webhook_logs"("receivedAt");

CREATE TABLE IF NOT EXISTS "unique_access_links" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "memberId" TEXT,
  "token" TEXT NOT NULL,
  "telegramGroupId" TEXT,
  "inviteLink" TEXT,
  "expiresAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "telegramUserId" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_access_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unique_access_links_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "unique_access_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "unique_access_links_token_key" UNIQUE ("token")
);
CREATE INDEX IF NOT EXISTS "unique_access_links_webhookId_idx" ON "unique_access_links"("webhookId");
CREATE INDEX IF NOT EXISTS "unique_access_links_token_idx" ON "unique_access_links"("token");
CREATE INDEX IF NOT EXISTS "unique_access_links_userId_idx" ON "unique_access_links"("userId");

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "variables" JSONB NOT NULL DEFAULT '[]',
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_templates_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "email_templates_webhookId_idx" ON "email_templates"("webhookId");
CREATE INDEX IF NOT EXISTS "email_templates_userId_idx" ON "email_templates"("userId");
