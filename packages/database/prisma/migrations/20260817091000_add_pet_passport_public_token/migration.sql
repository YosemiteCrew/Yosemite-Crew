-- Public passport verification moves off the raw patient id and onto a
-- high-entropy, revocable share token.
--
-- The patient id was previously the only credential on the unauthenticated
-- verification endpoint. It is returned to every authenticated client and
-- appears in application routes, so anyone who learned one could read the pet's
-- microchip and full cross-practice clinical history indefinitely, with no
-- expiry and no way to revoke.
--
-- The token itself is stored rather than a hash: it is embedded in the QR of
-- wallet passes already on owners' phones, so regenerating a pass must reuse the
-- existing token rather than invalidate the copies already issued.

ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicTokenIssuedAt" TIMESTAMP(3);
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "publicTokenRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PetPassport_publicToken_key"
  ON "PetPassport"("publicToken");
