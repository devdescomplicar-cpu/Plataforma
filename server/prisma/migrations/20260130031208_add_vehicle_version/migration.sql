-- AlterTable (IF NOT EXISTS: idempotente quando o schema completo já criou a coluna)
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "version" TEXT;
