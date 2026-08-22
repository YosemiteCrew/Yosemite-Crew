import { prisma } from "src/config/prisma";

/**
 * Narrow a set of user ids to those holding an ACTIVE membership in an
 * organisation.
 *
 * Assignment notifications carry companion names, appointment details and task
 * notes, and the recipient ids originate in client-supplied appointment/task
 * payloads. Looking those ids up directly meant a caller with creation rights
 * could name a user from another organisation and have the system email that
 * account the contents of a record it has no relationship with. Filtering here
 * turns "whoever was named" into "whoever actually works here".
 *
 * References are stored either bare or as `Organization/<id>`, matching
 * `rbac.ts`.
 */
export const filterUserIdsInOrganisation = async (
  userIds: readonly string[],
  organisationId: string | null | undefined,
): Promise<Set<string>> => {
  const org = organisationId?.trim();
  const wanted = [...new Set(userIds.filter((id) => id?.trim()))];
  if (!org || wanted.length === 0) {
    return new Set();
  }

  const memberships = await prisma.userOrganization.findMany({
    where: {
      practitionerReference: { in: wanted },
      active: true,
      OR: [
        { organizationReference: org },
        { organizationReference: `Organization/${org}` },
      ],
    },
    select: { practitionerReference: true },
  });

  return new Set(memberships.map((row) => row.practitionerReference));
};
