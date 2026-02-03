-- Identidade empresarial completa: dados fiscais, endereço, contato, presença digital, identidade visual, configuração de relatórios.
-- Todas as colunas são opcionais para não quebrar dados existentes.

ALTER TABLE "accounts" ADD COLUMN "storeLegalName" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeTradeName" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeCpfCnpj" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeStateRegistration" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeStreet" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeNumber" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeComplement" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeNeighborhood" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeZipCode" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeEmail" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storePhone" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeWebsite" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeInstagram" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeFacebook" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeLogoDark" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storePrimaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN "storeSecondaryColor" TEXT;
ALTER TABLE "accounts" ADD COLUMN "reportResponsible" TEXT;
ALTER TABLE "accounts" ADD COLUMN "reportCurrency" TEXT DEFAULT 'BRL';
ALTER TABLE "accounts" ADD COLUMN "reportDateFormat" TEXT DEFAULT 'DD/MM';
ALTER TABLE "accounts" ADD COLUMN "reportThousandSeparator" TEXT DEFAULT ',';
ALTER TABLE "accounts" ADD COLUMN "reportShowCents" BOOLEAN DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN "reportIncludeLegalNotice" BOOLEAN DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN "reportLegalNoticeText" TEXT;
