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

ALTER TABLE "Invoice"
    ADD COLUMN "dueAt" TIMESTAMP(3),
    ADD COLUMN "collectionsReviewedAt" TIMESTAMP(3),
    ADD COLUMN "collectionsReviewedBy" TEXT;

-- Invoices finalized before payment terms existed were due on receipt, so each
-- one is due by the end of the practice's day it was finalized on. The
-- practice's zone is the one on its earliest staff profile, as the API reads it;
-- a missing or unknown zone falls back to UTC, again as the API does.
WITH "PracticeZone" AS (
    SELECT DISTINCT ON (up."organizationId")
        up."organizationId" AS "organisationId",
        tz.name AS "zone"
    FROM "UserProfile" up
    LEFT JOIN pg_timezone_names tz
        ON tz.name = up."personalDetails"->>'timezone'
    ORDER BY up."organizationId", up."createdAt" ASC
)
UPDATE "Invoice" i
SET "dueAt" = (
    (
        date_trunc(
            'day',
            (i."finalizedAt" AT TIME ZONE 'UTC') AT TIME ZONE COALESCE(pz."zone", 'UTC')
        ) + INTERVAL '1 day'
    ) AT TIME ZONE COALESCE(pz."zone", 'UTC')
) AT TIME ZONE 'UTC' - INTERVAL '1 millisecond'
FROM "Invoice" src
LEFT JOIN "PracticeZone" pz ON pz."organisationId" = src."organisationId"
WHERE src."id" = i."id"
  AND src."finalizedAt" IS NOT NULL;

CREATE INDEX "Invoice_organisationId_dueAt_idx"
    ON "Invoice"("organisationId", "dueAt");

-- ENABLE without FORCE, as 20260818090000 and 20260923170000. The API connects
-- as the owning role, which bypasses row level security, so it only denies the
-- anon and authenticated PostgREST roles, which no code path here uses.
--
-- deployed-code-survives: the table is created above in this same migration,
-- so the deployed application has no query that names it. Its only reader and
-- writer ship with this migration and connect as the owning role.
ALTER TABLE "ClientPaymentTerm" ENABLE ROW LEVEL SECURITY;
