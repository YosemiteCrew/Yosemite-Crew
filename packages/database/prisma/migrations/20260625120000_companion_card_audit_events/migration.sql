-- Companion Card share/view/revoke audit events.
-- Enum values must be added in their own migration before any table or row
-- references them: PostgreSQL forbids using a newly added enum value in the
-- same transaction that creates it, and Prisma wraps each migration in one
-- transaction. The CompanionShareToken table lands in the next migration.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPANION_CARD_SHARE_ISSUED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPANION_CARD_VIEWED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'COMPANION_CARD_SHARE_REVOKED';
