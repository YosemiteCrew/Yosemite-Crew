-- Structured repeat eligibility for prescriptions (#3162 delivery 1).
--
-- Until now the only record of a repeat was "PrescriptionItem"."refill", free
-- text written for a human. Nothing could answer "is this patient still
-- entitled to another fill, and for how much" without a person reading a
-- sentence, so nothing could refuse an over-dispense either.
--
-- Two tables, and they answer different questions. "PrescriptionFillAuthorization"
-- is the clinician's decision: how many additional fills, how much per fill,
-- until when. It is immutable once issued - a correction is a new row pointing
-- at the one it supersedes - so a reader that acted on version 1 can be refused
-- rather than silently given version 2's allowance.
-- "PrescriptionFillReservation" is the allocation of one of those fills, and it
-- is what makes remaining capacity a count rather than an opinion.
--
-- "fillOrdinal" is an allocation sequence, not a repeat index: ordinal 0 is the
-- initial fill and a cancelled ordinal is never reused. That is what lets the
-- unique index below be total. A partial unique index would model "1..N with
-- reuse" exactly, but Postgres partial indexes cannot be declared in
-- schema.prisma and the drift check in this workflow emits a DROP for any index
-- the datamodel does not carry. Remaining capacity is counted from the
-- non-cancelled rows under an advisory lock; the index is what turns a lost
-- lock into a constraint violation instead of an over-allocation.
--
-- Purely additive. Two new tables and two new enums are invisible to the code
-- currently deployed - it has no statement that reads or writes either - so
-- this is safe to apply before the cutover and safe to leave behind on a
-- rollback. Nothing is backfilled: an item with no row here has no authorised
-- repeat, which is exactly what "Not authorised" means and what every existing
-- item means today.

-- CreateEnum
CREATE TYPE "PrescriptionFillAuthorizationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PrescriptionFillReservationStatus" AS ENUM ('RESERVED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PrescriptionFillAuthorization" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId" TEXT,
    "prescriptionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "maxAdditionalFills" INTEGER NOT NULL,
    "perFillQuantity" DECIMAL(65,30) NOT NULL,
    "perFillQuantityUnit" TEXT NOT NULL,
    "status" "PrescriptionFillAuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "authorisedBy" TEXT NOT NULL,
    "authorisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionFillAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionFillReservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dispenseRequestId" TEXT,
    "fillOrdinal" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "fulfilledQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quantityUnit" TEXT NOT NULL,
    "status" "PrescriptionFillReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "idempotencyKey" TEXT NOT NULL,
    "reservedBy" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionFillReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionFillAuthorization_supersedesId_key" ON "PrescriptionFillAuthorization"("supersedesId");

-- CreateIndex
CREATE INDEX "PrescriptionFillAuthorization_organisationId_itemId_status_idx" ON "PrescriptionFillAuthorization"("organisationId", "itemId", "status");

-- CreateIndex
CREATE INDEX "PrescriptionFillAuthorization_organisationId_prescriptionId_idx" ON "PrescriptionFillAuthorization"("organisationId", "prescriptionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionFillAuthorization_itemId_version_key" ON "PrescriptionFillAuthorization"("itemId", "version");

-- CreateIndex
CREATE INDEX "PrescriptionFillReservation_organisationId_status_idx" ON "PrescriptionFillReservation"("organisationId", "status");

-- CreateIndex
CREATE INDEX "PrescriptionFillReservation_dispenseRequestId_idx" ON "PrescriptionFillReservation"("dispenseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionFillReservation_authorizationId_fillOrdinal_key" ON "PrescriptionFillReservation"("authorizationId", "fillOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionFillReservation_organisationId_idempotencyKey_key" ON "PrescriptionFillReservation"("organisationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PrescriptionFillAuthorization" ADD CONSTRAINT "PrescriptionFillAuthorization_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PrescriptionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionFillAuthorization" ADD CONSTRAINT "PrescriptionFillAuthorization_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "PrescriptionFillAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionFillReservation" ADD CONSTRAINT "PrescriptionFillReservation_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PrescriptionFillAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- deployed-code-survives: both tables are created above in this same migration,
--   so no deployed query names either one and the enable takes rows away from
--   no existing reader. Their only readers and writers are the fill
--   authorisation service and controller shipping in this same PR, which
--   connect as the owning role and bypass row-level security, matching every
--   other ENABLE ROW LEVEL SECURITY in this migration set. If the smoke boot
--   fails and the deploy stops before cutting over, the previously deployed
--   code carries on untouched: it has no statement that reads or writes either
--   table.
-- Deny direct Supabase PostgREST access; the API connects as the owning role.
-- Both tables name an organisation, a patient and the clinician who authorised
-- or allocated a controlled quantity, so leaving them readable would expose one
-- practice's prescribing to the anon and authenticated keys.
ALTER TABLE "PrescriptionFillAuthorization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrescriptionFillReservation" ENABLE ROW LEVEL SECURITY;
