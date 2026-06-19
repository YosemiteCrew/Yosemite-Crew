-- Rename patient domain enums.
ALTER TYPE "CompanionType" RENAME TO "PatientType";
ALTER TYPE "CompanionOrganisationRole" RENAME TO "PatientOrganisationRole";
ALTER TYPE "CompanionOrganisationStatus" RENAME TO "PatientOrganisationStatus";
ALTER TYPE "ParentCompanionRole" RENAME TO "ParentPatientRole";
ALTER TYPE "ParentCompanionStatus" RENAME TO "ParentPatientStatus";

ALTER TYPE "AuditEntityType" RENAME VALUE 'COMPANION_ORGANISATION' TO 'PATIENT_ORGANISATION';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_CREATED' TO 'PATIENT_ORG_LINK_CREATED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_REQUESTED' TO 'PATIENT_ORG_LINK_REQUESTED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_APPROVED' TO 'PATIENT_ORG_LINK_APPROVED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_REJECTED' TO 'PATIENT_ORG_LINK_REJECTED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_REVOKED' TO 'PATIENT_ORG_LINK_REVOKED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_INVITE_ACCEPTED' TO 'PATIENT_ORG_INVITE_ACCEPTED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_INVITE_REJECTED' TO 'PATIENT_ORG_INVITE_REJECTED';
ALTER TYPE "AuditEventType" RENAME VALUE 'COMPANION_ORG_LINK_AUTO' TO 'PATIENT_ORG_LINK_AUTO';

-- Rename the core persisted tables.
ALTER TABLE "Companion" RENAME TO "Patient";
ALTER TABLE "CompanionOrganisation" RENAME TO "PatientOrganisation";
ALTER TABLE "ParentCompanion" RENAME TO "ParentPatient";
ALTER TABLE "Organization" ALTER COLUMN "petNamePreference" SET DEFAULT 'PATIENT';

-- Rename patient-centric columns.
ALTER TABLE "ContactRequest" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "LabOrder" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Document" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "PatientOrganisation" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "ParentPatient" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Appointment" RENAME COLUMN "companion" TO "patient";
ALTER TABLE "Case" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Encounter" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Admission" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "ChatSession" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "CoParentInvite" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "ExternalExpense" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "FormSubmission" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Task" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "TaskSchedule" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "TaskCompletion" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "AuditTrail" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "ObservationToolSubmission" RENAME COLUMN "companionId" TO "patientId";
ALTER TABLE "Invoice" RENAME COLUMN "companionId" TO "patientId";

-- Rename constraints and indexes that Prisma and the app depend on.
ALTER TABLE "Patient" RENAME CONSTRAINT "Companion_pkey" TO "Patient_pkey";
ALTER TABLE "PatientOrganisation" RENAME CONSTRAINT "CompanionOrganisation_pkey" TO "PatientOrganisation_pkey";
ALTER TABLE "PatientOrganisation" RENAME CONSTRAINT "CompanionOrganisation_companionId_fkey" TO "PatientOrganisation_patientId_fkey";
ALTER TABLE "ParentPatient" RENAME CONSTRAINT "ParentCompanion_pkey" TO "ParentPatient_pkey";
ALTER INDEX "ParentCompanion_parentId_companionId_key" RENAME TO "ParentPatient_parentId_patientId_key";
ALTER TABLE "ParentPatient" RENAME CONSTRAINT "ParentCompanion_companionId_fkey" TO "ParentPatient_patientId_fkey";
ALTER TABLE "Document" RENAME CONSTRAINT "Document_companionId_fkey" TO "Document_patientId_fkey";

ALTER INDEX "Companion_type_idx" RENAME TO "Patient_type_idx";
ALTER INDEX "Companion_status_idx" RENAME TO "Patient_status_idx";
ALTER INDEX "Document_companionId_idx" RENAME TO "Document_patientId_idx";
ALTER INDEX "Document_companionId_category_idx" RENAME TO "Document_patientId_category_idx";
ALTER INDEX "Document_companionId_pmsVisible_idx" RENAME TO "Document_patientId_pmsVisible_idx";
ALTER INDEX "CompanionOrganisation_companionId_idx" RENAME TO "PatientOrganisation_patientId_idx";
ALTER INDEX "CompanionOrganisation_organisationId_idx" RENAME TO "PatientOrganisation_organisationId_idx";
ALTER INDEX "companion_org_unique_active" RENAME TO "patient_org_unique_active";
ALTER INDEX "ParentCompanion_parentId_idx" RENAME TO "ParentPatient_parentId_idx";
ALTER INDEX "ParentCompanion_companionId_idx" RENAME TO "ParentPatient_patientId_idx";
ALTER INDEX "ContactRequest_companionId_idx" RENAME TO "ContactRequest_patientId_idx";
ALTER INDEX "Case_companionId_idx" RENAME TO "Case_patientId_idx";
ALTER INDEX "Encounter_companionId_idx" RENAME TO "Encounter_patientId_idx";
ALTER INDEX "Admission_companionId_idx" RENAME TO "Admission_patientId_idx";
ALTER INDEX "ExternalExpense_companionId_idx" RENAME TO "ExternalExpense_patientId_idx";
ALTER INDEX "FormSubmission_companionId_idx" RENAME TO "FormSubmission_patientId_idx";
ALTER INDEX "Task_companionId_dueAt_idx" RENAME TO "Task_patientId_dueAt_idx";
ALTER INDEX "TaskSchedule_companionId_idx" RENAME TO "TaskSchedule_patientId_idx";
ALTER INDEX "TaskCompletion_companionId_idx" RENAME TO "TaskCompletion_patientId_idx";
ALTER INDEX "AuditTrail_companionId_idx" RENAME TO "AuditTrail_patientId_idx";
ALTER INDEX "AuditTrail_organisationId_companionId_occurredAt_idx" RENAME TO "AuditTrail_organisationId_patientId_occurredAt_idx";
ALTER INDEX "ObservationToolSubmission_companionId_idx" RENAME TO "ObservationToolSubmission_patientId_idx";
