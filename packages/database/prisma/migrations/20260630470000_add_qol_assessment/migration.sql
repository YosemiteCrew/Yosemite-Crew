-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'QOL_ASSESSMENT_RECORDED';

-- CreateTable
CREATE TABLE "QualityOfLifeAssessment" (
    "id"                    TEXT NOT NULL,
    "organisationId"        TEXT NOT NULL,
    "patientId"             TEXT NOT NULL,
    "encounterId"           TEXT,
    "assessedAt"            TIMESTAMP(3) NOT NULL,
    "assessedBy"            TEXT,
    "hhhhhmmScore"          INTEGER,
    "painScore"             INTEGER,
    "appetiteScore"         INTEGER,
    "hygieneScore"          INTEGER,
    "happinessScore"        INTEGER,
    "mobilityScore"         INTEGER,
    "moreDaysGood"          BOOLEAN,
    "overallScore"          INTEGER,
    "ownerAssessed"         BOOLEAN NOT NULL DEFAULT false,
    "clinicianNotes"        TEXT,
    "ownerNotes"            TEXT,
    "euthanasiaDiscussed"   BOOLEAN,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityOfLifeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityOfLifeAssessment_organisationId_patientId_idx"
    ON "QualityOfLifeAssessment"("organisationId", "patientId");
