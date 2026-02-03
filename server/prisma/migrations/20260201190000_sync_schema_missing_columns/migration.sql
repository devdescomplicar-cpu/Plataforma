-- Sincroniza banco com schema Prisma: adiciona tabelas/colunas que possam faltar.
-- Tudo idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS). Sem DROP, sem perda de dados.

-- ========== Tabela notification_templates (referenciada por notification_template_usage_logs mas sem CREATE em migrações anteriores) ==========
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
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_trigger_channel_daysOffset_key" ON "notification_templates"("trigger", "channel", "daysOffset");
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ========== accounts: colunas de identidade/loja/relatório (store_identity_complete pode ter falhado ou não ter IF NOT EXISTS) ==========
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeLegalName" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeTradeName" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeCpfCnpj" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeStateRegistration" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeStreet" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeNumber" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeComplement" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeNeighborhood" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeZipCode" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeCity" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeState" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeEmail" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storePhone" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeWhatsApp" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeWebsite" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeInstagram" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeFacebook" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeLogo" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeLogoDark" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storePrimaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeSecondaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportResponsible" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportCurrency" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportDateFormat" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportThousandSeparator" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportShowCents" BOOLEAN;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportIncludeLegalNotice" BOOLEAN;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportLegalNoticeText" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "settings" JSONB;

-- ========== vehicles: version + consignado ==========
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "version" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentOwnerName" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentOwnerPhone" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentCommissionType" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentCommissionValue" DOUBLE PRECISION;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentMinRepassValue" DOUBLE PRECISION;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "consignmentStartDate" TIMESTAMP(3);

-- ========== vehicle_images ==========
ALTER TABLE "vehicle_images" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
ALTER TABLE "vehicle_images" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ========== webhook_logs ==========
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "processedInTestMode" BOOLEAN;

-- ========== plans ==========
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxVehicles" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxStorageMb" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxClients" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "durationType" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "customBenefits" JSONB;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ========== subscriptions ==========
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ========== clients (endereço completo – garantir que todas as colunas existam) ==========
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "complement" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "observations" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referredByClientId" TEXT;

-- Índices em clients (se não existirem)
CREATE INDEX IF NOT EXISTS "clients_zipCode_idx" ON "clients"("zipCode");
CREATE INDEX IF NOT EXISTS "clients_state_idx" ON "clients"("state");
CREATE INDEX IF NOT EXISTS "clients_referredByClientId_idx" ON "clients"("referredByClientId");

-- ========== email_logs: coluna origin pode ter tipo diferente em alguns ambientes ==========
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "origin" TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
