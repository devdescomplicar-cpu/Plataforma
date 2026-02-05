-- CreateTable: account_collaborators (colaboradores da conta: vendedor/gerente)
-- Apenas cria tabela e adiciona colunas; não exclui nem altera dados existentes.
CREATE TABLE IF NOT EXISTS "account_collaborators" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "commissionType" TEXT,
    "commissionValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "account_collaborators_pkey" PRIMARY KEY ("id")
);

-- AddColumn: Sale.registeredById e commissionAmount (somente se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'registeredById') THEN
    ALTER TABLE "sales" ADD COLUMN "registeredById" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'commissionAmount') THEN
    ALTER TABLE "sales" ADD COLUMN "commissionAmount" DOUBLE PRECISION;
  END IF;
END $$;

-- CreateIndex (ignorar se já existir)
CREATE UNIQUE INDEX IF NOT EXISTS "account_collaborators_accountId_userId_key" ON "account_collaborators"("accountId", "userId");
CREATE INDEX IF NOT EXISTS "account_collaborators_accountId_idx" ON "account_collaborators"("accountId");
CREATE INDEX IF NOT EXISTS "account_collaborators_userId_idx" ON "account_collaborators"("userId");
CREATE INDEX IF NOT EXISTS "account_collaborators_status_idx" ON "account_collaborators"("status");
CREATE INDEX IF NOT EXISTS "account_collaborators_deletedAt_idx" ON "account_collaborators"("deletedAt");
CREATE INDEX IF NOT EXISTS "sales_registeredById_idx" ON "sales"("registeredById");

-- AddForeignKey (ignorar se já existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_collaborators_accountId_fkey') THEN
    ALTER TABLE "account_collaborators" ADD CONSTRAINT "account_collaborators_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_collaborators_userId_fkey') THEN
    ALTER TABLE "account_collaborators" ADD CONSTRAINT "account_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_registeredById_fkey') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
