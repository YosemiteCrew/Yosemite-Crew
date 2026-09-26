CREATE TYPE "CalendarBlockTargetType" AS ENUM ('STAFF', 'ROOM');

CREATE TABLE "CalendarBlock" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "targetType" "CalendarBlockTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarBlock_organisationId_startAt_endAt_idx"
    ON "CalendarBlock"("organisationId", "startAt", "endAt");
CREATE INDEX "CalendarBlock_organisationId_targetType_targetId_startAt_idx"
    ON "CalendarBlock"("organisationId", "targetType", "targetId", "startAt");

ALTER TABLE "CalendarBlock" ENABLE ROW LEVEL SECURITY;

-- deployed-code-survives: Calendar blocks are stored separately, leaving existing appointments unchanged.
