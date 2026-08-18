-- Staff wallet passes get their own practice-scoped token.
--
-- Staff pass builders previously embedded the OWNER's `publicToken`. That token
-- resolves with "owner" scope, which shows the pet's records from every practice
-- with no consent gate, so a practice could read through its own wallet pass the
-- cross-practice history that the consent filter withholds from its passport
-- view. Requiring the owner to have created the link first limited who could
-- trigger it, but did not change what the token granted once handed over.
--
-- This token is bound to the passport row's organisation and resolves with
-- "practice" scope, so it grants no more than the staff member already has.
-- That is why a staff session may mint it, while `publicToken` stays owner-only.
--
-- Stored rather than hashed, for the same reason as `publicToken`: it is baked
-- into the QR of passes already on devices, so it must be readable back.

ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "practiceWalletToken" TEXT;
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "practiceWalletTokenIssuedAt" TIMESTAMP(3);
ALTER TABLE "PetPassport" ADD COLUMN IF NOT EXISTS "practiceWalletTokenRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PetPassport_practiceWalletToken_key"
  ON "PetPassport"("practiceWalletToken");
