import type { AuthHooks } from "@yosemite-crew/auth";
import { prisma } from "src/config/prisma";
import {
  practitionerReferenceFilter,
  resolveCanonicalUserId,
} from "src/services/shared/staff-identity";
import logger from "src/utils/logger";

// Application-side hooks for the auth boundary. They give the provider layer
// access to app data (which product a user belongs to) and record identity
// mappings, without the auth package depending on the database.

export const authHooks: AuthHooks = {
  // Product profile is derived from HOW the user authenticates, never from
  // their email address: one person can be both clinic staff and a pet owner
  // under the same address, and each product must resolve to its own profile
  // for the current session. Email and password is a staff-web first factor
  // (only staff hold a password; migrated staff set one via the password-reset
  // link); email OTP and social are the pet-parent mobile product. This
  // deliberately mirrors the package default - the earlier email lookup let a
  // pet-parent's mobile OTP session be stamped pims_web whenever the address
  // matched a staff row, 403-locking dual-role users out of the mobile app.
  resolveAuthProfile({ loginMethod }) {
    if (loginMethod === "emailpassword") {
      return Promise.resolve("pims_web");
    }
    if (loginMethod === "otp-email" || loginMethod.startsWith("thirdparty")) {
      return Promise.resolve("pet_parent_mobile");
    }
    // Unknown method: defer to the package default.
    return Promise.resolve(undefined);
  },

  /**
   * Refuse sign-in for a user whose every organisation has been disabled.
   *
   * The signal is `Organization.isActive`, which is what `PATCH /businesses/:id`
   * (SuperAdminBusinessService.updateBusiness) actually writes. Before this,
   * nothing in the sign-in path read it: `require-active-account.ts` checks
   * `User.isActive`, a different flag written by the user soft-delete, and only
   * on developer routes.
   *
   * Three deliberate choices:
   *
   * - No membership at all means NOT blocked. Pet parents have no
   *   `userOrganization` row, and an empty list must not be read as "belongs to
   *   nothing, therefore disabled" or every mobile user loses their account.
   * - Blocked only when EVERY organisation is inactive. Someone who works at a
   *   disabled practice and an active one still has a job; per-organisation
   *   authorisation decides what they can reach once they are in.
   * - `isVerified` is NOT consulted. Every business is unverified before review,
   *   so blocking on it would lock out each new practice awaiting approval - a
   *   pending business is not a disabled one, and the schema cannot tell a
   *   rejected business from one nobody has looked at yet.
   */
  async isSignInBlocked({ appUserId, providerUserId }) {
    const suppliedIds = [appUserId, providerUserId]
      .map((id) => id?.trim())
      .filter((id): id is string => !!id);
    if (suppliedIds.length === 0) {
      return false;
    }

    // Both id spaces and both reference forms, via the shared filter.
    //
    // This is the one place where a missed membership row is DANGEROUS rather
    // than merely lossy. `memberships.length === 0` is read below as "pet
    // parent, not staff, not blocked", so any query that fails to find a
    // staff user's rows silently un-enforces the disable for them - and the
    // two states are indistinguishable by construction, so nothing logs.
    //
    // Nothing has resolved these ids yet, unlike every authorised request,
    // which goes through `resolveAppUserId` before RBAC reads a membership.
    // `appUserId` is the raw SuperTokens `result.user.id` and
    // `providerUserId` the recipe user id; they differ once accounts are
    // linked, and `authIdentity` is keyed on the second. A migrated staff
    // account stores its rows under the legacy app user id either of them
    // maps to, and `practitionerReference` may carry either form.
    const canonicalIds = await Promise.all(
      suppliedIds.map((id) => resolveCanonicalUserId(id)),
    );

    const memberships = await prisma.userOrganization.findMany({
      where: {
        active: true,
        OR: practitionerReferenceFilter([...suppliedIds, ...canonicalIds]),
      },
      select: { organizationReference: true },
    });
    if (memberships.length === 0) {
      return false;
    }

    // Mappings are stored either bare or as a FHIR `Organization/<id>`
    // reference, exactly as `rbac.ts` and `OrganisationService.listForUser`
    // match them.
    const organisationIds = [
      ...new Set(
        memberships.map((row) =>
          row.organizationReference.replace(/^Organization\//, ""),
        ),
      ),
    ];

    const activeCount = await prisma.organization.count({
      where: { id: { in: organisationIds }, isActive: true },
    });
    return activeCount === 0;
  },

  async onUserCreated({
    appUserId,
    providerUserId,
    provider,
    authProfile,
    email,
  }) {
    if (provider !== "supertokens") {
      return;
    }
    try {
      await prisma.authIdentity.upsert({
        where: {
          provider_providerUserId: { provider, providerUserId },
        },
        update: { appUserId, email, authProfile },
        create: { provider, providerUserId, appUserId, email, authProfile },
      });
    } catch (error) {
      // Never block a successful sign-up on bookkeeping; the mapping row is
      // recoverable from provider data.
      logger.error("Failed to record auth identity mapping", error);
    }
  },

  async resolveAppUserId({
    appUserId,
    providerUserId,
    provider,
    authProfile,
    email,
  }) {
    if (provider !== "supertokens") {
      return appUserId;
    }

    try {
      const normalizedEmail = email?.trim().toLowerCase();

      // Only relink a provider account that has NOT already been bound. Once a
      // mapping exists it is the answer; re-deriving it from the email on every
      // login would let a later collision silently move a live session onto a
      // different account.
      const boundMapping = await prisma.authIdentity.findFirst({
        where: { provider, providerUserId },
        select: { appUserId: true },
      });

      if (!boundMapping && normalizedEmail && authProfile) {
        const candidates = await prisma.authIdentity.findMany({
          where: {
            email: normalizedEmail,
            authProfile,
          },
          orderBy: { createdAt: "asc" },
          select: {
            appUserId: true,
          },
        });

        const legacyAppUserIds = [
          ...new Set(
            candidates
              .map((candidate) => candidate.appUserId)
              .filter((candidateId) => candidateId !== appUserId),
          ),
        ];

        // Ambiguity is a takeover primitive, not a migration case. `email` is
        // indexed but not unique, so a shared mailbox, a duplicated legacy
        // import, or a recycled address can produce several legacy accounts for
        // one address. Adopting "the oldest" would hand the new session whichever
        // account happens to sort first, so refuse instead and let the account
        // stand on its own id.
        if (legacyAppUserIds.length > 1) {
          logger.error(
            "Ambiguous legacy identity for auth profile; refusing to relink",
            { authProfile, candidateCount: legacyAppUserIds.length },
          );
          return appUserId;
        }

        const legacyCandidate = legacyAppUserIds[0]
          ? { appUserId: legacyAppUserIds[0] }
          : undefined;

        if (legacyCandidate) {
          await prisma.authIdentity.upsert({
            where: {
              provider_providerUserId: {
                provider,
                providerUserId,
              },
            },
            update: {
              appUserId: legacyCandidate.appUserId,
              email: normalizedEmail,
              authProfile,
            },
            create: {
              provider,
              providerUserId,
              appUserId: legacyCandidate.appUserId,
              email: normalizedEmail,
              authProfile,
            },
          });

          return legacyCandidate.appUserId;
        }
      }

      return boundMapping?.appUserId ?? appUserId;
    } catch (error) {
      logger.error("Failed to resolve auth identity mapping", error);
      return appUserId;
    }
  },
};
