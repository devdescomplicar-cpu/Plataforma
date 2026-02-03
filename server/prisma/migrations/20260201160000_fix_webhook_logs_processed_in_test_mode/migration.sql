-- Fix existing logs: set processedInTestMode = false where response indicates production (data.data.action = created/updated/restored/account_created)
UPDATE "webhook_logs"
SET "processedInTestMode" = false
WHERE "processedInTestMode" = true
  AND "statusCode" IN (200, 201)
  AND "response" IS NOT NULL
  AND ("response" #>> '{data,data,action}') IN ('created', 'updated', 'restored', 'account_created');
