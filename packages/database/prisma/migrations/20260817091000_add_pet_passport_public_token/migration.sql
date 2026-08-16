-- Public passport verification moves off the raw patient id and onto a
-- high-entropy, revocable share token.
--
-- The patient id was previously the only credential on the unauthenticated
-- verification endpoint. It is returned to every authenticated client and
-- appears in application routes, so anyone who learned one could read the pet's
-- microchip and full cross-practice clinical history indefinitely, with no
-- expiry and no way to revoke.
--
-- Only the SHA-256 hash of the token is stored, matching CompanionShareToken,
-- so a database disclosure cannot mint a working link.

ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicTokenHash" TEXT;
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicTokenIssuedAt" TIMESTAMP(3);
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicTokenRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PetPassport_publicTokenHash_key"
  ON "PetPassport"("publicTokenHash");
