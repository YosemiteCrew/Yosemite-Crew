-- Link a waitlist entry to the appointment `book()` actually creates for it.
--
-- Before this, `book()` only flipped WaitlistEntry.status to BOOKED - it never
-- created an Appointment, so the Board never showed the patient and there was
-- no row to point back to. This column is that missing pointer, written once
-- when book() succeeds.
--
-- Nullable, not backfilled: every existing entry (WAITING/OFFERED/BOOKED under
-- the old dead-end behaviour) has no real appointment to point at. A BOOKED
-- entry from before this migration stays NULL forever - that is honest, since
-- no appointment was actually created for it.
--
-- UNIQUE because the conversion is one-time: once an entry names an
-- appointment, no other entry may claim the same one. A patient who cancels
-- and re-joins the waitlist gets a new WaitlistEntry row, not a reused link.
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

SET LOCAL lock_timeout = '5s';

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_appointmentId_key" ON "WaitlistEntry"("appointmentId");
