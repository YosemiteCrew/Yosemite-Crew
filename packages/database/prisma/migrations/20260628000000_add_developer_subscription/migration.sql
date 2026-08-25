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
