-- AlterTable: Adicionar campo originalSalePrice na tabela sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "originalSalePrice" DOUBLE PRECISION;
