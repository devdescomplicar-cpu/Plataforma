-- Webhook Base: estrutura idêntica à outra plataforma (receive por id, serverUrl, testMode, logs, mapeamentos em tabela)
-- Preserva dados existentes: migra webhooks atuais para novo formato

-- 0) Se a tabela webhooks não existir (banco novo), criar no formato novo
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "serverUrl" TEXT NOT NULL,
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

-- 1) Adicionar novas colunas em webhooks (se a tabela já existia com schema antigo)
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "serverUrl" TEXT;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT false;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN DEFAULT true;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "lastTestPayload" JSONB;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "actions" JSONB DEFAULT '[]';
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "secret" TEXT;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "users"("id") ON DELETE CASCADE;

-- 2) Preencher registros existentes (compatibilidade com schema antigo: slug, active)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'webhooks') THEN
    UPDATE "webhooks"
    SET
      "serverUrl" = COALESCE("serverUrl", 'http://localhost:3001/api/webhooks/receive/' || id),
      "userId" = COALESCE("userId", (SELECT id FROM "users" WHERE role = 'admin' LIMIT 1))
    WHERE "serverUrl" IS NULL OR "userId" IS NULL;
    UPDATE "webhooks" SET "serverUrl" = 'http://localhost:3001/api/webhooks/receive/' || id WHERE "serverUrl" IS NULL;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'webhooks' AND column_name = 'active') THEN
      UPDATE "webhooks" SET "isActive" = COALESCE("isActive", active) WHERE "isActive" IS NULL;
    END IF;
  END IF;
END $$;

-- 3) Remover colunas antigas (se existirem)
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "slug";
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "fieldMappings";
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "active";

-- 4) Garantir NOT NULL onde necessário (apenas se a tabela já tiver dados)
DO $$
BEGIN
  ALTER TABLE "webhooks" ALTER COLUMN "serverUrl" SET DEFAULT 'http://localhost:3001/api/webhooks/receive/';
  ALTER TABLE "webhooks" ALTER COLUMN "serverUrl" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "webhooks" ALTER COLUMN "userId" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4b) Índices em webhooks (após colunas existirem)
CREATE INDEX IF NOT EXISTS "webhooks_userId_idx" ON "webhooks"("userId");
CREATE INDEX IF NOT EXISTS "webhooks_isActive_idx" ON "webhooks"("isActive");
CREATE INDEX IF NOT EXISTS "webhooks_deletedAt_idx" ON "webhooks"("deletedAt");

-- 5) Criar tabela webhook_field_mappings
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

-- 6) Criar tabela webhook_logs
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

-- 7) Criar tabela unique_access_links
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

-- 8) Criar tabela email_templates
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "variables" JSONB NOT NULL DEFAULT '[]',
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_templates_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "email_templates_webhookId_idx" ON "email_templates"("webhookId");
CREATE INDEX IF NOT EXISTS "email_templates_userId_idx" ON "email_templates"("userId");
