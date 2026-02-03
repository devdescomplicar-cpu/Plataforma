-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "trigger" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "daysOffset" INTEGER,
    "subject" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_templates_trigger_idx" ON "notification_templates"("trigger");

-- CreateIndex
CREATE INDEX "notification_templates_channel_idx" ON "notification_templates"("channel");

-- CreateIndex
CREATE INDEX "notification_templates_deletedAt_idx" ON "notification_templates"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_trigger_channel_daysOffset_key" ON "notification_templates"("trigger", "channel", "daysOffset");
