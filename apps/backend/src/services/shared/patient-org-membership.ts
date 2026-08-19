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

/**
 * The bulk form. A per-id loop would issue one query per companion, and the
 * bulk reminder endpoint accepts up to 200, so membership is resolved in a
 * single `findMany` and compared as a set.
 *
 * All-or-nothing on purpose: a partial write would leave the caller unable to
 * tell which ids were rejected without the error naming them, and naming them
 * is exactly the probe this check exists to prevent.
 */
export const assertPatientsOrgMembership = async (
  patientIds: readonly string[],
  organisationId: string,
  throwNotFound: () => never,
): Promise<void> => {
  const wanted = [...new Set(patientIds)];
  if (wanted.length === 0) return;
  const rows = await prisma.patientOrganisation.findMany({
    where: {
      patientId: { in: wanted },
      organisationId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { patientId: true },
  });
  const found = new Set(rows.map((row) => row.patientId));
  if (wanted.some((id) => !found.has(id))) {
    throwNotFound();
  }
};
