-- CreateTable
CREATE TABLE "DeveloperApiUsage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperApiUsage_organisationId_billingPeriod_key" ON "DeveloperApiUsage"("organisationId", "billingPeriod");

-- CreateIndex
CREATE INDEX "DeveloperApiUsage_billingPeriod_idx" ON "DeveloperApiUsage"("billingPeriod");

-- Enable row level security, as 20260818090000_enable_row_level_security does for
-- every table that existed when it ran. That migration is a one-shot loop, so a
-- table created after it ships unprotected: Supabase exposes everything in
-- `public` over PostgREST to the `anon` and `authenticated` keys, and with RLS
-- off those keys can read it directly. The API connects as the owning role, which
-- bypasses RLS, so Prisma queries are unaffected; enabling with no policy simply
-- denies the PostgREST path by default. CI enforces this.
ALTER TABLE "DeveloperApiUsage" ENABLE ROW LEVEL SECURITY;
