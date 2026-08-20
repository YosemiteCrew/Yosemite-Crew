-- ActivityPub federation models

CREATE TYPE "APFollowerState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');
CREATE TYPE "APFollowingState" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "APDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "APReferralState" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE "APReferralUrgency" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

CREATE TABLE "APActor" (
    "id"                TEXT NOT NULL,
    "organisationId"    TEXT,
    "uri"               TEXT NOT NULL,
    "preferredUsername" TEXT NOT NULL,
    "publicKeyPem"      TEXT NOT NULL,
    "privateKeyPem"     TEXT NOT NULL,
    "publicKeyId"       TEXT NOT NULL,
    "inboxUri"          TEXT NOT NULL,
    "outboxUri"         TEXT NOT NULL,
    "followersUri"      TEXT NOT NULL,
    "followingUri"      TEXT NOT NULL,
    "sharedInboxUri"    TEXT,
    "name"              TEXT,
    "summary"           TEXT,
    "iconUrl"           TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APActor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APActor_organisationId_key" ON "APActor"("organisationId");
CREATE UNIQUE INDEX "APActor_uri_key" ON "APActor"("uri");
CREATE UNIQUE INDEX "APActor_preferredUsername_key" ON "APActor"("preferredUsername");
CREATE UNIQUE INDEX "APActor_publicKeyId_key" ON "APActor"("publicKeyId");

CREATE TABLE "APFollower" (
    "id"              TEXT NOT NULL,
    "localActorId"    TEXT NOT NULL,
    "remoteActorUri"  TEXT NOT NULL,
    "remoteInboxUri"  TEXT NOT NULL,
    "sharedInboxUri"  TEXT,
    "state"           "APFollowerState" NOT NULL DEFAULT 'PENDING',
    "approvedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APFollower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APFollower_localActorId_remoteActorUri_key" ON "APFollower"("localActorId", "remoteActorUri");
CREATE INDEX "APFollower_localActorId_state_idx" ON "APFollower"("localActorId", "state");

CREATE TABLE "APFollowing" (
    "id"              TEXT NOT NULL,
    "localActorId"    TEXT NOT NULL,
    "remoteActorUri"  TEXT NOT NULL,
    "remoteInboxUri"  TEXT NOT NULL,
    "sharedInboxUri"  TEXT,
    "state"           "APFollowingState" NOT NULL DEFAULT 'PENDING',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APFollowing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APFollowing_localActorId_remoteActorUri_key" ON "APFollowing"("localActorId", "remoteActorUri");
CREATE INDEX "APFollowing_localActorId_state_idx" ON "APFollowing"("localActorId", "state");

CREATE TABLE "APRemoteActor" (
    "id"                TEXT NOT NULL,
    "uri"               TEXT NOT NULL,
    "preferredUsername" TEXT NOT NULL,
    "publicKeyPem"      TEXT NOT NULL,
    "publicKeyId"       TEXT NOT NULL,
    "inboxUri"          TEXT NOT NULL,
    "sharedInboxUri"    TEXT,
    "instanceHost"      TEXT NOT NULL,
    "fetchedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"        TIMESTAMP(3),
    "licenseToken"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APRemoteActor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APRemoteActor_uri_key" ON "APRemoteActor"("uri");
CREATE UNIQUE INDEX "APRemoteActor_publicKeyId_key" ON "APRemoteActor"("publicKeyId");
CREATE INDEX "APRemoteActor_instanceHost_idx" ON "APRemoteActor"("instanceHost");

CREATE TABLE "APActivity" (
    "id"            TEXT NOT NULL,
    "uri"           TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "localActorId"  TEXT NOT NULL,
    "objectUri"     TEXT,
    "objectJson"    JSONB,
    "toAddresses"   TEXT[],
    "ccAddresses"   TEXT[],
    "published"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed"     BOOLEAN NOT NULL DEFAULT false,
    "direction"     "APDirection" NOT NULL,
    "rawJson"       JSONB NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APActivity_uri_key" ON "APActivity"("uri");
CREATE INDEX "APActivity_localActorId_direction_idx" ON "APActivity"("localActorId", "direction");
CREATE INDEX "APActivity_type_processed_idx" ON "APActivity"("type", "processed");

CREATE TABLE "APReferral" (
    "id"              TEXT NOT NULL,
    "activityUri"     TEXT NOT NULL,
    "fromActorUri"    TEXT NOT NULL,
    "toActorUri"      TEXT NOT NULL,
    "fromOrgId"       TEXT,
    "toOrgId"         TEXT,
    "patientSummary"  JSONB NOT NULL,
    "clinicalContext" TEXT,
    "urgency"         "APReferralUrgency" NOT NULL DEFAULT 'ROUTINE',
    "state"           "APReferralState" NOT NULL DEFAULT 'PENDING',
    "acceptedAt"      TIMESTAMP(3),
    "declinedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "APReferral_activityUri_key" ON "APReferral"("activityUri");
CREATE INDEX "APReferral_toOrgId_state_idx" ON "APReferral"("toOrgId", "state");
CREATE INDEX "APReferral_fromOrgId_state_idx" ON "APReferral"("fromOrgId", "state");

ALTER TABLE "APFollower" ADD CONSTRAINT "APFollower_localActorId_fkey"
    FOREIGN KEY ("localActorId") REFERENCES "APActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "APFollowing" ADD CONSTRAINT "APFollowing_localActorId_fkey"
    FOREIGN KEY ("localActorId") REFERENCES "APActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "APActivity" ADD CONSTRAINT "APActivity_localActorId_fkey"
    FOREIGN KEY ("localActorId") REFERENCES "APActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable row level security on the tables this migration creates.
--
-- 20260818090000_enable_row_level_security switches RLS on for every table in
-- the public schema, but it is already applied and therefore immutable, and
-- these tables are created after it. Without this block the CI check "row level
-- security is enabled on every public table" fails, and on Supabase the tables
-- would be readable directly over PostgREST by the anon and authenticated keys.
--
-- Enabling with no policy is the intended default here, exactly as in that
-- migration: the API connects as the owning role, which bypasses RLS, so Prisma
-- queries are unaffected. What it closes is the PostgREST surface. Tenant
-- scoping stays in the application's organisation filters.
ALTER TABLE "APActor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "APFollower" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "APFollowing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "APRemoteActor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "APActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "APReferral" ENABLE ROW LEVEL SECURITY;
