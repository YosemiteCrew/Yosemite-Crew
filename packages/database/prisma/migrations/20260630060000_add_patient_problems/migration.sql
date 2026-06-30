ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROBLEM_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROBLEM_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROBLEM_RESOLVED';

CREATE TYPE "ProblemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESOLVED');
CREATE TYPE "ProblemSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

CREATE TABLE "PatientProblem" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "encounterId"    TEXT,
    "name"           TEXT NOT NULL,
    "codeSystem"     TEXT,
    "code"           TEXT,
    "status"         "ProblemStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity"       "ProblemSeverity",
    "onsetDate"      TIMESTAMP(3),
    "resolvedDate"   TIMESTAMP(3),
    "notes"          TEXT,
    "recordedBy"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientProblem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientProblem_organisationId_patientId_status_idx"
    ON "PatientProblem"("organisationId", "patientId", "status");
CREATE INDEX "PatientProblem_organisationId_patientId_idx"
    ON "PatientProblem"("organisationId", "patientId");
