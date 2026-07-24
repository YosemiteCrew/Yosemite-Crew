import type { Prisma } from "@prisma/client";

/**
 * Tenant scope for PMS-side `Document` reads.
 *
 * `Document` has no `organisationId` column, so the only way to scope a document
 * to an organisation is to join through `patientOrganisation`. `pmsVisible` is
 * part of the scope rather than an optional filter: a document a parent kept
 * private to themselves is not PMS data for any organisation, so every PMS read
 * path must express both halves together or it leaks.
 */
export const documentWhereForOrg = (
  organisationId: string,
): Prisma.DocumentWhereInput => ({
  pmsVisible: true,
  patient: {
    organisations: {
      some: {
        organisationId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
    },
  },
});
