CREATE TABLE "OrgSubscriptionEntitlements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "value" JSONB,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSubscriptionEntitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgSubscriptionEntitlements_orgId_code_key" ON "OrgSubscriptionEntitlements"("orgId", "code");
CREATE INDEX "OrgSubscriptionEntitlements_orgId_status_idx" ON "OrgSubscriptionEntitlements"("orgId", "status");

CREATE TABLE "OrgSubscriptionProviderLinks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "externalSubscriptionItemId" TEXT,
    "externalPriceId" TEXT,
    "externalProductId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSubscriptionProviderLinks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgSubscriptionProviderLinks_orgId_provider_key" ON "OrgSubscriptionProviderLinks"("orgId", "provider");
CREATE INDEX "OrgSubscriptionProviderLinks_externalSubscriptionId_idx" ON "OrgSubscriptionProviderLinks"("externalSubscriptionId");
CREATE INDEX "OrgSubscriptionProviderLinks_externalCustomerId_idx" ON "OrgSubscriptionProviderLinks"("externalCustomerId");

CREATE TABLE "OrgUsageEvents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "usageKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "billableQuantity" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUsageEvents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgUsageEvents_orgId_usageKey_occurredAt_idx" ON "OrgUsageEvents"("orgId", "usageKey", "occurredAt");
CREATE INDEX "OrgUsageEvents_orgId_referenceType_referenceId_idx" ON "OrgUsageEvents"("orgId", "referenceType", "referenceId");

CREATE TABLE "OrgUsageSnapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'snapshot',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seatsActive" INTEGER NOT NULL DEFAULT 0,
    "seatsBillable" INTEGER NOT NULL DEFAULT 0,
    "appointmentsUsed" INTEGER NOT NULL DEFAULT 0,
    "toolsUsed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUsageSnapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgUsageSnapshots_orgId_snapshotAt_idx" ON "OrgUsageSnapshots"("orgId", "snapshotAt");
