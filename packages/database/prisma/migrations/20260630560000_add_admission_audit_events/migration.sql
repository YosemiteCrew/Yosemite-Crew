-- Add AuditEventType values for Admission (model already exists)
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ADMISSION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ADMISSION_DISCHARGED';
