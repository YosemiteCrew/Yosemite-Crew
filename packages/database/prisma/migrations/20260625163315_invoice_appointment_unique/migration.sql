DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Invoice"
    WHERE "appointmentId" IS NOT NULL
    GROUP BY "appointmentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add unique constraint Invoice.appointmentId because duplicate non-null appointmentId values already exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_appointmentId_key"
ON "Invoice"("appointmentId");
