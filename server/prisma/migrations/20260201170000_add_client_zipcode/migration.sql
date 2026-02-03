-- Add zipCode (CEP) column to clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
CREATE INDEX IF NOT EXISTS "clients_zipCode_idx" ON "clients"("zipCode");
