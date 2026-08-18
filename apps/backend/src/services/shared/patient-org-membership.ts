import { prisma } from "src/config/prisma";

/**
 * Confirms a companion belongs to the caller's organisation.
 *
 * Patient reads are not org-scoped and several clinical tables carry a bare
 * `patientId` column with no foreign key, so a create that trusts the body id
 * will happily persist a row against a nonexistent or another tenant's
 * companion - a clinical record that no companion view will ever surface.
 *
 * `throwNotFound` is supplied by the caller so each service keeps raising its
 * own typed error; the message stays the uniform "Companion not found." 404 so
 * this cannot be used to probe which patient ids exist.
 */
export const assertPatientOrgMembership = async (
  patientId: string,
  organisationId: string,
  throwNotFound: () => never,
): Promise<void> => {
  const membership = await prisma.patientOrganisation.findFirst({
    where: { patientId, organisationId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true },
  });
  if (!membership) {
    throwNotFound();
  }
};
