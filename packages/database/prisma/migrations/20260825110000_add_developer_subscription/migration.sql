-- CreateEnum
CREATE TYPE "DeveloperPlanTier" AS ENUM ('free', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "DeveloperSubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- CreateTable
CREATE TABLE "DeveloperSubscriptions" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "plan" "DeveloperPlanTier" NOT NULL DEFAULT 'free',
    "status" "DeveloperSubscriptionStatus" NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionItemId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastStripeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperSubscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperSubscriptions_organisationId_key" ON "DeveloperSubscriptions"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperSubscriptions_stripeSubscriptionId_key" ON "DeveloperSubscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "DeveloperSubscriptions_stripeCustomerId_idx" ON "DeveloperSubscriptions"("stripeCustomerId");

-- Enable row level security, as 20260818090000_enable_row_level_security does for
-- every table that existed when it ran. That migration is a one-shot loop, so a
-- table created after it ships unprotected: Supabase exposes everything in
-- `public` over PostgREST to the `anon` and `authenticated` keys, and with RLS
-- off those keys can read it directly. The API connects as the owning role, which
-- bypasses RLS, so Prisma queries are unaffected; enabling with no policy simply
-- denies the PostgREST path by default. CI enforces this.
ALTER TABLE "DeveloperSubscriptions" ENABLE ROW LEVEL SECURITY;
