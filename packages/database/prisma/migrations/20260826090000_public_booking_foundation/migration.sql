-- Foundation for the public booking page.
--
-- Until now the onboarding wizard computed `book.yosemitecrew.com/<slug>` in the
-- browser from the practice name, showed it, and offered to copy it. Nothing was
-- stored, the subdomain has no DNS record, and no route served it - a practice
-- could paste that URL onto its own website and publish a dead link. These
-- tables are what the wizard writes to instead.
--
-- Three decisions are encoded here rather than in application code:
--
--  1. `BookingSlugReservation`, not `Organization."bookingSlug"`, owns the slug
--     namespace. A slug is claimed by inserting here first, in the same
--     transaction that denormalises it onto the organisation, so two practices
--     both named "Park Vets" collide on a primary key under concurrency rather
--     than racing a read-then-write. Rows are never deleted: a booking URL ends
--     up on a printed card and in a Google listing, so a renamed practice keeps
--     resolving its old slug and gets redirected to the current one.
--
--  2. `publicBookingEnabled` defaults to false. Publishing is opt-in. No
--     existing practice becomes reachable on the public internet because this
--     migration ran.
--
--  3. `autoConfirm` defaults to false, so a public request is a REQUEST that a
--     human accepts through the accept/reject routes the PMS already has, not a
--     write straight into a working calendar.
--
-- Additive and backfill-free: every column is nullable or defaulted, and the
-- unique index lands on a column that is NULL for every existing row (Postgres
-- treats NULLs as distinct, so no pre-check for duplicates is needed).

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "bookingSlug" TEXT,
ADD COLUMN     "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BookingSlugReservation" (
    "slug" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSlugReservation_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "PublicBookingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceIds" TEXT[],
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 28,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "replyToEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicBookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSlugReservation_organizationId_idx" ON "BookingSlugReservation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicBookingSettings_organizationId_key" ON "PublicBookingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_bookingSlug_key" ON "Organization"("bookingSlug");

-- AddForeignKey
ALTER TABLE "BookingSlugReservation" ADD CONSTRAINT "BookingSlugReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicBookingSettings" ADD CONSTRAINT "PublicBookingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS, per 20260818090000_enable_row_level_security.
--
-- That migration was a one-shot loop over the tables that existed when it ran,
-- so a table added afterwards ships unprotected unless it says so here - the
-- same reason 20260820100000_activitypub_federation repeats these lines.
-- Enabling with no policy is the intended default: the API connects as the
-- owning role and bypasses RLS, so Prisma queries are unaffected. What it closes
-- is the PostgREST surface, where Supabase would otherwise expose both tables to
-- the `anon` key - and one of them is about to back an unauthenticated page.
ALTER TABLE "BookingSlugReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicBookingSettings" ENABLE ROW LEVEL SECURITY;
