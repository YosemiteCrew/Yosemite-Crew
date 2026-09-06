import { prisma } from "src/config/prisma";

const ORGANISATION_PREFIX = "Organization/";
const LEADING_ORGANISATION_PREFIX = /^Organization\//;

/**
 * Every spelling a membership row can carry for one organisation.
 *
 * `userOrganization.organizationReference` is persisted verbatim from the FHIR
 * PractitionerRole's `organization.reference` (`fromFHIRUserOrganization`), and
 * the create path strips the prefix only to look the organisation up - never to
 * normalise what it stores. So the column holds whatever the client sent: the
 * bare id, or the conformant `Organization/<id>`. An organisation is also
 * addressable by `fhirId`, so pass every id you hold for it.
 *
 * A query that matches one spelling silently answers a narrower question than
 * it looks like it is asking, and returns zero rather than an error when the
 * data uses the other one.
 */
export const organisationReferenceMatches = (
  ...organisationIds: ReadonlyArray<string | null | undefined>
): Array<{ organizationReference: string }> => {
  const spellings = new Set<string>();

  for (const raw of organisationIds) {
    const id = raw?.trim().replace(LEADING_ORGANISATION_PREFIX, "");
    if (!id) {
      continue;
    }
    spellings.add(id);
    spellings.add(`${ORGANISATION_PREFIX}${id}`);
  }

  return [...spellings].map((organizationReference) => ({
    organizationReference,
  }));
};

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
      OR: organisationReferenceMatches(org),
    },
    select: { practitionerReference: true },
  });

  return new Set(memberships.map((row) => row.practitionerReference));
};
