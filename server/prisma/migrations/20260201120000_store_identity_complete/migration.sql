-- Identidade empresarial completa: dados fiscais, endereço, contato, presença digital, identidade visual, configuração de relatórios.
-- IF NOT EXISTS: idempotente quando o schema completo já criou as colunas.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeLegalName" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeTradeName" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeCpfCnpj" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeStateRegistration" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeStreet" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeNumber" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeComplement" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeNeighborhood" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeZipCode" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeEmail" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storePhone" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeWebsite" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeInstagram" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeFacebook" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeLogoDark" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storePrimaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "storeSecondaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportResponsible" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportCurrency" TEXT DEFAULT 'BRL';
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportDateFormat" TEXT DEFAULT 'DD/MM';
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportThousandSeparator" TEXT DEFAULT ',';
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportShowCents" BOOLEAN DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportIncludeLegalNotice" BOOLEAN DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "reportLegalNoticeText" TEXT;
