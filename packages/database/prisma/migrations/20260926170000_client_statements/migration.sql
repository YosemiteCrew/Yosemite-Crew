-- Store each generated client statement as one immutable snapshot. The
-- idempotency key is scoped to the account so a retry reads back the same
-- statement instead of creating a second document.
CREATE TABLE "ClientStatement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientStatement_organisationId_parentId_idempotencyKey_key"
ON "ClientStatement"("organisationId", "parentId", "idempotencyKey");

CREATE INDEX "ClientStatement_organisationId_parentId_createdAt_idx"
ON "ClientStatement"("organisationId", "parentId", "createdAt");

CREATE INDEX "ClientStatement_organisationId_id_idx"
ON "ClientStatement"("organisationId", "id");

ALTER TABLE "ClientStatement" ENABLE ROW LEVEL SECURITY;
