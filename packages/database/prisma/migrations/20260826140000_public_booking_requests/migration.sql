-- Booking requests submitted by members of the public.
--
-- Phase 2 of this change opens `/book/<slug>` as a read-only page. This table is
-- phase 3: the request a pet owner submits from it.
--
-- Why a table of its own rather than an `Appointment` in `REQUESTED`, which
-- would have reused the practice's existing accept/reject queue:
--
--  1. `createAppointment` asserts that a real Parent manages a real Companion
--     (`CompanionOrganisationService.assertParentManagesCompanion`). An
--     anonymous requester has neither, so satisfying it means minting a Parent
--     and a Companion from unverified form input - handing the practice patient
--     records for a person who may not exist, before any human has looked.
--  2. The `REQUESTED` queue is the practice's own work queue. Letting an
--     unauthenticated caller write into it makes flooding it a public capability.
--
-- So a request stays inert until a human at the practice reads it and books it.
--
-- `confirmationTokenHash` stores SHA-256 of the emailed token, never the token.
-- Reading the table therefore does not let anyone confirm a request, the same
-- way the companion-card and passport share tokens are resolved by hash.
--
-- `purgeAfter` exists because these rows are personal data - a name, an email
-- address, a phone number and an animal's details - belonging to someone with no
-- relationship to the practice, in a product operating under GDPR. A scheduled
-- job deletes rows past it, and the column is indexed so that job is a range
-- scan rather than a table walk. Storage limitation is a property of the schema
-- here, not of somebody remembering.
--
-- Additive: one new enum, one new table, no change to any existing row.

-- CreateEnum
CREATE TYPE "PublicBookingRequestStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'BOOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PublicBookingRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productItemId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "requestedEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "petName" TEXT NOT NULL,
    "petSpecies" TEXT NOT NULL,
    "concern" TEXT,
    "status" "PublicBookingRequestStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "confirmationTokenHash" TEXT NOT NULL,
    "confirmationExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
    "purgeAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicBookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicBookingRequest_confirmationTokenHash_key" ON "PublicBookingRequest"("confirmationTokenHash");

-- CreateIndex
CREATE INDEX "PublicBookingRequest_organizationId_status_requestedStart_idx" ON "PublicBookingRequest"("organizationId", "status", "requestedStart");

-- CreateIndex
CREATE INDEX "PublicBookingRequest_purgeAfter_idx" ON "PublicBookingRequest"("purgeAfter");

-- AddForeignKey
ALTER TABLE "PublicBookingRequest" ADD CONSTRAINT "PublicBookingRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS, per 20260818090000_enable_row_level_security.
--
-- That migration was a one-shot loop over the tables that existed when it ran,
-- so a table added later ships unprotected unless it says so here. It matters
-- more than usual for this one: the rows are unverified personal data, and
-- without RLS Supabase would expose them over PostgREST to the `anon` key -
-- the very audience the form collects them from.
ALTER TABLE "PublicBookingRequest" ENABLE ROW LEVEL SECURITY;
