-- Add address columns to clients table (street, number, complement, neighborhood, city)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "complement" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "city" TEXT;
