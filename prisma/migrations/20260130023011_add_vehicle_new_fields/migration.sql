-- AlterTable: Adicionar novos campos ao modelo Vehicle
ALTER TABLE "vehicles" 
ADD COLUMN IF NOT EXISTS "km" INTEGER,
ADD COLUMN IF NOT EXISTS "transmission" TEXT,
ADD COLUMN IF NOT EXISTS "steering" TEXT,
ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'own',
ADD COLUMN IF NOT EXISTS "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "consignmentOwnerName" TEXT,
ADD COLUMN IF NOT EXISTS "consignmentOwnerPhone" TEXT,
ADD COLUMN IF NOT EXISTS "consignmentCommissionType" TEXT,
ADD COLUMN IF NOT EXISTS "consignmentCommissionValue" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "consignmentMinRepassValue" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "consignmentStartDate" TIMESTAMP(3);

-- AlterTable: tornar purchasePrice e salePrice opcionais (se ainda não forem)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' 
    AND column_name = 'purchasePrice' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "vehicles" ALTER COLUMN "purchasePrice" DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' 
    AND column_name = 'salePrice' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "vehicles" ALTER COLUMN "salePrice" DROP NOT NULL;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vehicles_origin_idx" ON "vehicles"("origin");
