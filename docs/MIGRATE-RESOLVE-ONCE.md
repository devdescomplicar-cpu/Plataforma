# Resolver migração falha (uma vez)

Se o deploy falhou com **P3018** / "relation \"users\" does not exist" na migração `20250130000000_webhook_base`, o banco ficou com essa migração marcada como **failed**. A migração inicial `20250129000000_initial_users_accounts` foi ajustada para criar **todas as tabelas** do schema (gerada com `prisma migrate diff`).

**Faça uma vez** (com a `DATABASE_URL` de produção, ex.: no Easypanel ou num job):

```bash
cd server
npx prisma migrate resolve --rolled-back "20250130000000_webhook_base"
```

Isso marca a migração como "rolled back". No próximo **deploy**:

1. `prisma migrate deploy` aplica `20250129000000_initial_users_accounts` (cria todas as tabelas do schema).
2. Em seguida aplica as demais migrações (webhook_base, etc.); como as tabelas já existem, os `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS` não quebram.

**Como rodar no Easypanel:** crie um Job ou use o shell do app com a mesma `DATABASE_URL`, instale dependências e execute o comando acima.
