-- Existing counts predate durable delivery tracking, so they remain usage
-- history while meteredCallCount starts at zero and reconciles only calls whose
-- provider delivery can actually be proven.
ALTER TABLE "DeveloperApiUsage"
ADD COLUMN "meteredCallCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "DeveloperMeterEvent" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "callSequence" INTEGER NOT NULL,
    "stripeCustomerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperMeterEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperMeterEvent_ownerUserId_billingPeriod_callSequence_key"
ON "DeveloperMeterEvent"("ownerUserId", "billingPeriod", "callSequence");

CREATE INDEX "DeveloperMeterEvent_deliveredAt_nextAttemptAt_idx"
ON "DeveloperMeterEvent"("deliveredAt", "nextAttemptAt");

CREATE INDEX "DeveloperMeterEvent_ownerUserId_billingPeriod_idx"
ON "DeveloperMeterEvent"("ownerUserId", "billingPeriod");

-- The API uses the owning database role. Direct PostgREST access must not
-- expose developer identities or Stripe customer ids.
-- deployed-code-survives: "DeveloperMeterEvent" is created above in this same
-- migration, so the deployed application has no query that names it. The new
-- reader and writer ship with this migration and use the owning API role,
-- which bypasses RLS; enabling it only denies direct PostgREST access.
ALTER TABLE "DeveloperMeterEvent" ENABLE ROW LEVEL SECURITY;
