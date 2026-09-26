ALTER TABLE "Appointment"
ADD COLUMN "recurrenceSeriesId" TEXT,
ADD COLUMN "recurrenceSeriesIndex" INTEGER,
ADD COLUMN "recurrenceSeriesTotal" INTEGER,
ADD COLUMN "recurrenceTimeZone" TEXT;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_recurrenceSeries_check"
CHECK (
  ("recurrenceSeriesId" IS NULL AND "recurrenceSeriesIndex" IS NULL AND "recurrenceSeriesTotal" IS NULL)
  OR (
    "recurrenceSeriesId" IS NOT NULL
    AND "recurrenceSeriesIndex" IS NOT NULL
    AND "recurrenceSeriesTotal" IS NOT NULL
    AND "recurrenceTimeZone" IS NOT NULL
    AND "recurrenceSeriesIndex" BETWEEN 1 AND "recurrenceSeriesTotal"
    AND "recurrenceSeriesTotal" BETWEEN 2 AND 52
  )
);

CREATE INDEX "Appointment_organisationId_recurrenceSeriesId_recurrenceSeriesIndex_idx"
ON "Appointment"("organisationId", "recurrenceSeriesId", "recurrenceSeriesIndex");
