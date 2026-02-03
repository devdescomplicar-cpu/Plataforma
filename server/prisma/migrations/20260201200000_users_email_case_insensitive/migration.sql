-- E-mail case-insensitive: normalizar existentes para minúsculas e garantir unicidade por LOWER(email)
UPDATE "users"
SET "email" = LOWER(TRIM("email"))
WHERE "email" IS NOT NULL AND "email" != LOWER(TRIM("email"));

-- Índice único por LOWER(email) para impedir duplicatas que diferem só por maiúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (LOWER("email"));
