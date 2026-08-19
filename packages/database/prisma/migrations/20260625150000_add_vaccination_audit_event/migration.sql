-- Vaccination audit event for the Digital Pet Passport.
-- Enum values are added in their own migration: PostgreSQL forbids using a newly
-- added enum value in the same transaction that creates it, and Prisma wraps each
-- migration in one transaction.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'VACCINATION_RECORDED';
