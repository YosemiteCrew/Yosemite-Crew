-- Practices differ in which vocabulary they need on the way out: a referral network may
-- want SNOMED, a UK first-opinion practice VeNom. The choice is per organisation rather
-- than per user, because two vets in one practice coding differently would reintroduce
-- exactly the inconsistency the coded spine exists to remove.
--
-- The preference governs OUTPUT only. Clinical pickers always offer the whole YC
-- vocabulary, because the alternative is a vet unable to record what they observed
-- simply because SNOMED has no term for it. On the current data that is not hypothetical:
-- SNOMED covers 344 of 4,819 exotics terms and 15 of 228 avian ones.
--
-- IDEXX is deliberately not an option. It is the ordering vocabulary for lab
-- requisitions, not a clinical record format.
--
-- Additive only, defaulting to the vocabulary we already emit.

CREATE TYPE "VocabularyPreference" AS ENUM ('YOSEMITECODE', 'VENOM', 'SNOMED');

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "preferredVocabulary" "VocabularyPreference" NOT NULL DEFAULT 'YOSEMITECODE';
