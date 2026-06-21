ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "appointmentLockWindowOutpatientMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "appointmentLockWindowInpatientMinutes" INTEGER;
