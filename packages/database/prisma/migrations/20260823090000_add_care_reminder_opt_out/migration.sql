-- CreateEnum
CREATE TYPE "CareReminderOptOutChannel" AS ENUM ('EMAIL', 'PUSH', 'ALL');

-- CreateTable
CREATE TABLE "CareReminderOptOut" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "channel" "CareReminderOptOutChannel" NOT NULL DEFAULT 'ALL',
    "parentId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareReminderOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareReminderOptOut_organisationId_email_channel_key" ON "CareReminderOptOut"("organisationId", "email", "channel");

-- CreateIndex
CREATE INDEX "CareReminderOptOut_organisationId_email_idx" ON "CareReminderOptOut"("organisationId", "email");
