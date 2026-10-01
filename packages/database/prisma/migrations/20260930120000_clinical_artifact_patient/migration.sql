-- Records which animal a clinical artifact is about (#2704).
--
-- An artifact's only reliable path to its patient was encounterId ->
-- Encounter.patientId, so a record written without an encounter never reached
-- the owner. New artifacts now carry the patient their writer resolved.
--
-- Purely additive. The column is nullable with no default, so rows written
-- before this read NULL and keep resolving through their encounter, and the
-- currently deployed code neither reads nor writes it.
ALTER TABLE "ClinicalArtifact" ADD COLUMN "patientId" TEXT;

CREATE INDEX "ClinicalArtifact_patientId_status_idx" ON "ClinicalArtifact"("patientId", "status");
