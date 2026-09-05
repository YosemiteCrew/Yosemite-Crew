import { prisma } from "src/config/prisma";

const SUPERTOKENS_PROVIDER = "supertokens";

/**
 * The canonical app user id behind an auth-provider id.
 *
 * A migrated staff account has TWO ids: the provider alias the client
 * authenticates with, and the legacy app user id its rows were imported under.
 * `authIdentity` is the mapping between them, and every authorised request
 * already resolves through it (`resolveAppUserId` in `packages/auth`) before
 * RBAC reads a membership. Anything that reads membership from a raw provider
 * id has to resolve it the same way or it is querying the wrong id space.
 *
 * Returns null when neither a `User` row nor a mapping exists.
 */
export const resolveCanonicalUserId = async (
  userId: string,
): Promise<string | null> => {
  const existing = await prisma.user.findFirst({
    where: { userId },
    select: { userId: true },
  });
  if (existing) {
    return existing.userId ?? userId;
  }

  const identity = await prisma.authIdentity.findFirst({
    where: {
      provider: SUPERTOKENS_PROVIDER,
      providerUserId: userId,
    },
    select: { appUserId: true },
  });

  return identity?.appUserId ?? null;
};

/**
 * A `where.OR` matching every form a user's `userOrganization` rows can be
 * stored under.
 *
 * Two dimensions, and missing either one returns an empty membership list for a
 * user who genuinely has memberships:
 *
 * - Two ids, per `resolveCanonicalUserId` above.
 * - Two reference forms. `practitionerReference` holds either a bare id or a
 *   FHIR `Practitioner/<id>` reference; `rbac.ts` and
 *   `OrganisationService.listForUser` match bare only, `UserService.deleteById`
 *   matches both. Querying only the bare form is what let a deletion remove no
 *   organisation roles and report success (see the comment on `deleteById`).
 *
 * Whether a miss is safe depends entirely on the caller: for a read it hides a
 * row, for an authorisation check it can grant one. Callers whose "no rows"
 * branch is permissive must use this.
 */
export const practitionerReferenceFilter = (
  ids: readonly (string | null | undefined)[],
): { practitionerReference: string }[] => {
  const unique = [
    ...new Set(
      ids
        .map((id) => id?.trim().replace(/^Practitioner\//, ""))
        .filter((id): id is string => !!id),
    ),
  ];

  return unique.flatMap((id) => [
    { practitionerReference: id },
    { practitionerReference: `Practitioner/${id}` },
  ]);
};
