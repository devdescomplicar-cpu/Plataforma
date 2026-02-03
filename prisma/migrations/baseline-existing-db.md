# Banco já existente (P3005)

Quando o banco já tem tabelas criadas fora do `prisma migrate`, o `migrate deploy` falha com P3005.

## Passo 1: Rodar o SQL das novas tabelas

Execute o SQL abaixo no PostgreSQL (uma vez). Pode ser com `psql`, DBeaver ou:

```bash
cd /app
psql "$DATABASE_URL" -f prisma/migrations/run-new-migrations.sql
```

Ou copie o conteúdo de `run-new-migrations.sql` e execute no seu cliente SQL.

## Passo 2: Marcar as migrations como aplicadas

Assim o Prisma passa a considerar essas migrations como já aplicadas e não tenta rodá-las de novo:

```bash
cd /app
npx prisma migrate resolve --applied "20250129000000_add_push_subscriptions" --schema=prisma/schema.prisma
npx prisma migrate resolve --applied "20250129100000_add_notification_templates" --schema=prisma/schema.prisma
```

## Conferir

```bash
npx prisma migrate status --schema=prisma/schema.prisma
```

Deve mostrar as duas migrations como aplicadas.
