-- Plans: add checkoutUrl, maxClients, customBenefits.
-- Safe: ADD COLUMN IF NOT EXISTS, no data loss.

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "maxClients" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "customBenefits" JSONB;
