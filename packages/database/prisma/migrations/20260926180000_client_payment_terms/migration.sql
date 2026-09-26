CREATE TABLE "ClientPaymentTerm" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "netDays" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPaymentTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPaymentTerm_organisationId_parentId_key"
    ON "ClientPaymentTerm"("organisationId", "parentId");
CREATE INDEX "ClientPaymentTerm_organisationId_idx"
    ON "ClientPaymentTerm"("organisationId");

ALTER TABLE "ClientPaymentTerm" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Invoice"
    ADD COLUMN "dueAt" TIMESTAMP(3),
    ADD COLUMN "collectionsReviewedAt" TIMESTAMP(3),
    ADD COLUMN "collectionsReviewedBy" TEXT;

UPDATE "Invoice"
SET "dueAt" = "finalizedAt"
WHERE "finalizedAt" IS NOT NULL;

CREATE INDEX "Invoice_organisationId_dueAt_idx"
    ON "Invoice"("organisationId", "dueAt");
