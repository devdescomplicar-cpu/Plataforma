-- Add state (UF) column to clients table for filtering by Brazilian state
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "state" TEXT;
CREATE INDEX IF NOT EXISTS "clients_state_idx" ON "clients"("state");
