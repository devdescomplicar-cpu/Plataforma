-- Add missing User columns: phone, cpfCnpj (schema/sync fix - no data loss)
-- Safe: ADD COLUMN IF NOT EXISTS, nullable, no DROP

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpfCnpj" TEXT;
