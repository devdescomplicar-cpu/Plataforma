-- CreateTable: account_collaborators (colaboradores da conta: vendedor/gerente)
CREATE TABLE "account_collaborators" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "commissionType" TEXT,
    "commissionValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "account_collaborators_pkey" PRIMARY KEY ("id")
);

-- AddColumn: Sale.registeredById e commissionAmount (quem registrou + comissão do vendedor)
ALTER TABLE "sales" ADD COLUMN "registeredById" TEXT;
ALTER TABLE "sales" ADD COLUMN "commissionAmount" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "account_collaborators_accountId_userId_key" ON "account_collaborators"("accountId", "userId");
CREATE INDEX "account_collaborators_accountId_idx" ON "account_collaborators"("accountId");
CREATE INDEX "account_collaborators_userId_idx" ON "account_collaborators"("userId");
CREATE INDEX "account_collaborators_status_idx" ON "account_collaborators"("status");
CREATE INDEX "account_collaborators_deletedAt_idx" ON "account_collaborators"("deletedAt");
CREATE INDEX "sales_registeredById_idx" ON "sales"("registeredById");

-- AddForeignKey
ALTER TABLE "account_collaborators" ADD CONSTRAINT "account_collaborators_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_collaborators" ADD CONSTRAINT "account_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
