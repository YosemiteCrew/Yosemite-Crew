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

-- Enable row level security, matching 20260818090000_enable_row_level_security.
--
-- That migration enables RLS by looping over every table in `public`, which makes
-- it idempotent but only covers tables that existed when it ran. This table is
-- created by a later migration, so it would ship with RLS off and the CI check
-- ("Check row level security is enabled on every public table") fails on it -
-- which is exactly how this was caught.
--
-- Enabling with no policy is the intended default: the API connects as the owning
-- role and bypasses RLS, so Prisma queries are unaffected, while Supabase's
-- PostgREST surface to the `anon` and `authenticated` keys is denied by default.
-- That matters more than usual here, because this table maps an email address to
-- the practice it belongs to.
ALTER TABLE "CareReminderOptOut" ENABLE ROW LEVEL SECURITY;
