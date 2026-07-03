-- AlterTable: org-level gate for cross-clinic (network) colleague messaging.
-- Off by default; a business owner enables it in Organisation settings.
ALTER TABLE "Organization" ADD COLUMN "crossOrgMessagingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: records the second clinic on a cross-org conversation so each
-- organisation can answer data requests for chats its staff take part in.
ALTER TABLE "ChatSession" ADD COLUMN "counterpartOrganisationId" TEXT;
