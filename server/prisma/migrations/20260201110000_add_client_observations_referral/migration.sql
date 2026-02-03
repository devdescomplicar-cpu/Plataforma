-- Add observations and referral (referredByClientId) to clients (idempotent)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "observations" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referredByClientId" TEXT;

CREATE INDEX IF NOT EXISTS "clients_referredByClientId_idx" ON "clients"("referredByClientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_referredByClientId_fkey'
  ) THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_referredByClientId_fkey"
      FOREIGN KEY ("referredByClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
