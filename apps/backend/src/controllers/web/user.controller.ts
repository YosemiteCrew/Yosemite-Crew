import { Request, Response } from "express";
import { getAuthService } from "@yosemite-crew/auth";
import logger from "../../utils/logger";
import {
  UserService,
  UserServiceError,
  resolveCanonicalUserId,
} from "../../services/user.service";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { resolveVerifiedUserId } from "src/utils/request";

type GetUserRequest = Request<{ id: string }>;
type UpdateUserNameRequest = Request<
  Record<string, never>,
  Record<string, never>,
  {
    firstName: string;
    lastName: string;
  }
>;

const trimmedString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * The roles a caller is allowed to claim for itself while provisioning.
 *
 * `POST /fhir/v1/user` is guarded by `requireWebAuth` alone, and the role is
 * read from the request body, so whatever passes this check is a role any
 * signed-up account can hand itself. The previous check was a shape test
 * (`/^[a-z_-]{1,40}$/i`) that accepted any word - `superadmin` included, which
 * `requireSuperAdmin` turns into read and write over every business on the
 * platform. A shape is not a permission; this is an allow-list for that reason.
 *
 * These two are what the sign-up form actually sends: `developer` for a
 * developer sign-up, and `member` for everyone else. Anything else is dropped
 * rather than refused, which is how an unparseable role has always been
 * treated - by this point the account already exists in the auth provider, so
 * failing the request would strand it with no application user behind it.
 */
const SELF_ASSIGNABLE_ROLES = new Set(["developer", "member"]);

// Names/role come from the signup form (request body) with the session as
// fallback; the session token no longer carries profile attributes.
function resolveProvisioningProfile(req: AuthenticatedRequest): {
  firstName?: string;
  lastName?: string;
  role?: string;
} {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const requestedRole = trimmedString(body.role)?.toLowerCase();
  const role =
    requestedRole && SELF_ASSIGNABLE_ROLES.has(requestedRole)
      ? requestedRole
      : undefined;

  // Worth a line in the log: a request naming a role it cannot have is either a
  // client sending something the form never offers, or someone reaching for a
  // privilege. Bounded and passed as a field, never concatenated into the
  // message, so a crafted value cannot forge log structure.
  if (requestedRole && !role) {
    logger.warn("Provisioning requested a role that is not self-assignable", {
      requestedRole: requestedRole.slice(0, 40),
    });
  }

  return {
    firstName: trimmedString(body.firstName) ?? req.firstName,
    lastName: trimmedString(body.lastName) ?? req.lastName,
    role,
  };
}

/**
 * The names this request actually SUPPLIED, ignoring the session fallback.
 *
 * The fallback in `resolveProvisioningProfile` exists so first-time creation
 * can proceed from session attributes when the body carries nothing. Applying
 * it to an account that already exists is a different act: it overwrites a
 * stored name with one the request never asked to change.
 *
 * That is not hypothetical. Under the cutover grace window
 * (`AUTH_LEGACY_TOKEN_GRACE=true`) `legacy-token-verifier.ts` fills these from
 * the `given_name`/`family_name` claims of a residual token. A token issued
 * before the user renamed themselves still carries the old pair, so the
 * no-body idempotent retry - which posts nothing precisely because it has
 * nothing to say - would push those stale claims over the current record.
 */
function suppliedNames(req: AuthenticatedRequest): {
  firstName?: string;
  lastName?: string;
} {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    firstName: trimmedString(body.firstName),
    lastName: trimmedString(body.lastName),
  };
}

/**
 * Whether the names the BODY offers can be acted on.
 *
 * A body that mentions either name must supply both, itself. Half a name in
 * the body silently completed from the session is an ambiguous request
 * answered with a guess: the caller asked to set one name, and the stored
 * value it gets paired with may be exactly what they meant to replace. Every
 * client sends both names or neither, so nothing legitimate is refused.
 *
 * The raw body has to be read because `trimmedString` collapses `""`,
 * whitespace and non-strings to `undefined` - without that an explicitly blank
 * pair is indistinguishable from an absent one, and the repeat path would
 * answer 200 to a rename it had silently refused.
 *
 * A body that says nothing about names is not judged here at all: that is the
 * legitimate repeat call, and whether it can proceed depends on whether the
 * account already exists - which is not known yet.
 */
function bodyNamesAreUsable(req: AuthenticatedRequest): boolean {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!("firstName" in body || "lastName" in body)) {
    return true;
  }
  return Boolean(trimmedString(body.firstName) && trimmedString(body.lastName));
}

/**
 * Whether a NEW account can be created from these names.
 *
 * Applies to creation only. `UserService.create` requires both names, so a
 * one-sided pair has to be refused - but refusing it before the account is
 * looked up is what made the idempotent retry fail: under the cutover grace
 * window a residual token can carry `given_name` without `family_name`
 * (`legacy-token-verifier.ts` maps the two claims independently), so the
 * no-body retry - which asks for no rename at all, and whose names are ignored
 * for an existing account - was answered 400 for a lopsided token it never
 * referred to.
 */
function creationNamesAreUsable(profile: {
  firstName?: string;
  lastName?: string;
}): boolean {
  return Boolean(profile.firstName) === Boolean(profile.lastName);
}

type AuthServiceForSync = NonNullable<ReturnType<typeof getAuthService>>;

/**
 * A role replacement that got halfway: the new role is granted, the old one is
 * still attached.
 *
 * Distinct from every other provider failure because it is the only one that
 * leaves state changed. The sync absorbs the rest; this one has to reach the
 * client so it retries while it still holds the role to re-apply.
 */
class RoleReplacementIncomplete extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RoleReplacementIncomplete";
  }
}

/**
 * Move the account onto `role`, clearing the one it replaces.
 *
 * `setUserRole` ADDS - it does not replace - so correcting `member` to
 * `developer` would otherwise leave the account holding both, and
 * `/v1/auth/me` answers with the first role the list returns. The correction
 * would report success and change nothing the user can see.
 *
 * Only the self-assignable roles are cleared. Removing every other role would
 * strip `superadmin` from an admin who did nothing more than re-provision
 * their name, and this endpoint has no business revoking a role it was never
 * allowed to grant.
 */
async function applyRole(
  authService: AuthServiceForSync,
  userId: string,
  role: string,
): Promise<void> {
  const replaced = [...SELF_ASSIGNABLE_ROLES].filter(
    (candidate) => candidate !== role,
  );

  try {
    // Grant before revoking: failing the other way round would leave the
    // account with no role at all.
    await authService.setUserRole(userId, role);
    for (const candidate of replaced) {
      await authService.removeUserRole(userId, candidate);
    }
  } catch (roleError) {
    /*
     * Every failure in here is treated as half-applied, including one from the
     * grant. `setUserRole` is itself three provider calls - create the role,
     * attach it, write the metadata - so a rejection does not mean nothing
     * changed: the role can already be attached with only the metadata write
     * outstanding. Assuming otherwise is what left both roles on the account.
     *
     * And nothing else repairs it. `provisionPendingSignUpUser` clears
     * `pendingSignUp` on any 2xx, so a later provisioning call carries no role
     * and never reaches this code at all. A 2xx here makes whatever state the
     * provider is in permanent, so the failure has to reach the client while it
     * still holds the role to retry with.
     */
    throw new RoleReplacementIncomplete(
      `Could not settle the account on ${role}`,
      { cause: roleError },
    );
  }
}

/**
 * Take the submitted names into the database for an account that already
 * exists, returning the row to serve back.
 *
 * The provider sync writes whatever names the request carried, so the database
 * has to accept the same ones: returning the stored row untouched while pushing
 * new names to the provider is how `/v1/auth/me` and `/fhir/v1/user/:id` end up
 * reporting different names for one account, with nothing to reconcile them -
 * `updateName` no-ops once the database matches, so no later call repairs it.
 *
 * A request carrying no names (the client posts no body once `pendingSignUp` is
 * gone) leaves the stored ones alone rather than clearing them.
 */
async function reconcileNames(
  userId: string,
  stored: Awaited<ReturnType<typeof UserService.getById>>,
  profile: { firstName?: string; lastName?: string },
): Promise<Awaited<ReturnType<typeof UserService.create>>> {
  if (!profile.firstName || !profile.lastName) {
    return stored!;
  }
  /*
   * Failures propagate. `updateName` writes the auth provider BEFORE the
   * database and is not atomic across the two, so a failure between them leaves
   * the provider holding a name the database never took - and `updateName`
   * no-ops once the database matches, so no later call repairs it. Answering
   * 200 over the stored row would make that divergence permanent and invisible.
   *
   * Failing is safe here in a way it is not on the creation path: the row this
   * reconciles already exists, so a 500 strands nothing. The client retries,
   * and every retry re-runs the same idempotent write.
   */
  return UserService.updateName({
    userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
  });
}

/**
 * Create the application user, or adopt the one a concurrent caller just made.
 *
 * The caller has already established that no row existed a moment ago, so this
 * is the creation path. The 409 recovery covers only the narrow race: someone
 * inserted between that lookup and this write.
 */
async function createOrAdopt(
  userId: string,
  email: string,
  profile: { firstName?: string; lastName?: string },
): Promise<{
  user: Awaited<ReturnType<typeof UserService.create>>;
  created: boolean;
}> {
  try {
    return {
      user: await UserService.create({
        id: userId,
        email,
        firstName: profile.firstName!,
        lastName: profile.lastName!,
      }),
      created: true,
    };
  } catch (error: unknown) {
    if (!(error instanceof UserServiceError) || error.statusCode !== 409) {
      throw error;
    }

    /*
     * A 409 matches on id OR email, so it does not prove the row is this
     * caller's. When nothing comes back for this id the row belongs to someone
     * else and the conflict stands, rather than handing over their record.
     */
    const winner = await UserService.getById(userId);
    if (!winner) {
      throw error;
    }
    return {
      user: await reconcileNames(userId, winner, profile),
      created: false,
    };
  }
}

// Best-effort profile sync to the auth provider so /v1/auth/me can serve
// names and role without touching the database.
async function syncProfileToAuthProvider(
  userId: string,
  profile: { firstName?: string; lastName?: string; role?: string },
): Promise<void> {
  const authService = getAuthService();
  if (!authService) {
    return;
  }
  /*
   * The two writes are isolated, not sequential steps of one try. Sharing a
   * catch meant a failed name sync returned early and skipped the role
   * entirely: the response was still 2xx, the client cleared its pending role,
   * and the correction was lost to a failure in the half of this function that
   * can afford to fail.
   */
  if (profile.firstName && profile.lastName) {
    try {
      await authService.updateUserName(userId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    } catch (nameSyncError) {
      // Genuinely best-effort: one call, nothing half-done, and the database
      // already holds the authoritative copy.
      logger.warn("Auth provider name sync failed", nameSyncError);
    }
  }

  // Not guarded. `applyRole` raises RoleReplacementIncomplete for anything that
  // may have changed provider state, and that has to reach the client - it is
  // the only thing here nothing else can repair.
  if (profile.role) {
    await applyRole(authService, userId, profile.role);
  }
}

export const UserController = {
  create: async (req: Request, res: Response) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { userId, email } = authRequest;

      if (!userId || !email) {
        return res
          .status(400)
          .json({ message: "Missing user identity from token." });
      }

      const profile = resolveProvisioningProfile(authRequest);

      if (!bodyNamesAreUsable(authRequest)) {
        return res
          .status(400)
          .json({ message: "Both first and last name are required." });
      }

      /*
       * Provisioning is idempotent, and the client already relies on that -
       * a verification link reopened in a new tab runs this a second time.
       * It was not: `UserService.create` throws 409 for an existing user and
       * the catch below returned before the profile sync, so the role reached
       * the auth provider on the FIRST call and never again. An account whose
       * role was wrong at sign-up - or absent, from a sign-up that predates the
       * role being sent - had no way to be corrected, and a developer sign-up
       * that lost its provisioning call stayed locked out of the portal for good.
       *
       * Safe to sync on a repeat call only because the role is now an
       * allow-list of `developer` and `member`: neither grants anything
       * server-side (the developer routes authorise on org permissions, not on
       * this role), so a caller re-asserting one gains no privilege. It would
       * not have been safe against the old shape check.
       */
      /*
       * Look the user up BEFORE attempting to create. `UserService.create`
       * validates first and last name before it checks for an existing row, and
       * a repeat call routinely carries neither: once `pendingSignUp` is gone
       * the client posts no body at all, and the session token no longer
       * carries profile attributes. Going through create would answer 400 to a
       * request whose only fault is being already done, and the recovery below
       * would never run.
       */
      const provisioned = await UserService.getById(userId);

      /*
       * `deleteById` is a soft delete: it sets `isActive: false` and keeps the
       * row, while genuinely removing the profile, availability and
       * organisation records around it. `getById` does not filter on that flag,
       * so treating any returned row as provisioned would answer 200 for an
       * account that was deleted - reporting success over a hollow identity and
       * quietly resurrecting nothing. Creation cannot repair it either: the row
       * still occupies the id and email. Refuse, as it did before this path
       * existed; reactivation is a separate decision about what to restore.
       */
      // Explicitly false, not merely falsy: refuse only when the row positively
      // says deleted. `isActive` is non-nullable in the schema, so an absent
      // value means something unexpected upstream - and locking a real account
      // out of provisioning is the worse way to be wrong about it.
      if (provisioned?.isActive === false) {
        return res
          .status(409)
          .json({ message: "This account has been deleted." });
      }

      /*
       * An existing account is reconciled against what the request SUPPLIED,
       * a new one against the profile including its session fallback. The
       * database write and the provider sync take the same pair either way -
       * letting them diverge is what leaves `/v1/auth/me` and
       * `/fhir/v1/user/:id` reporting different names with nothing to
       * reconcile them.
       */
      const names = provisioned ? suppliedNames(authRequest) : profile;

      // Only creation needs a complete pair, and only now is it known that this
      // is a creation. `UserService.create` would reject a one-sided pair
      // anyway; this answers with the endpoint's own message rather than the
      // service's field-level one.
      if (!provisioned && !creationNamesAreUsable(profile)) {
        return res
          .status(400)
          .json({ message: "Both first and last name are required." });
      }

      const { user, created } = provisioned
        ? {
            user: await reconcileNames(userId, provisioned, names),
            created: false,
          }
        : await createOrAdopt(userId, email, profile);

      await syncProfileToAuthProvider(userId, { ...names, role: profile.role });

      res.status(created ? 201 : 200).json(user);
    } catch (error: unknown) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to create user", error);
      res.status(500).json({ message: "Unable to create user." });
    }
  },

  getById: async (req: GetUserRequest, res: Response) => {
    try {
      const requesterId = resolveVerifiedUserId(req);
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "User id is required." });
      }

      if (!requesterId) {
        return res
          .status(401)
          .json({ message: "Missing user identity from token." });
      }

      const [resolvedRequesterId, resolvedTargetId] = await Promise.all([
        resolveCanonicalUserId(requesterId),
        resolveCanonicalUserId(id),
      ]);

      if (!resolvedRequesterId) {
        return res
          .status(401)
          .json({ message: "Missing user identity from token." });
      }

      if (!resolvedTargetId) {
        return res.status(404).json({ message: "User not found." });
      }

      if (resolvedRequesterId !== resolvedTargetId) {
        return res.status(403).json({
          message: "You can only view your own user.",
        });
      }

      const user = await UserService.getById(id);

      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      res.status(200).json(user);
    } catch (error: unknown) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to retrieve user", error);
      res.status(500).json({ message: "Unable to retrieve user." });
    }
  },

  deleteById: async (req: GetUserRequest, res: Response) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { id } = req.params;
      const requesterId = authRequest.userId;

      if (!id) {
        res.status(400).json({ message: "User id is required." });
        return;
      }

      if (!requesterId) {
        res.status(401).json({ message: "Missing user identity from token." });
        return;
      }

      const [resolvedRequesterId, resolvedTargetId] = await Promise.all([
        resolveCanonicalUserId(requesterId),
        resolveCanonicalUserId(id),
      ]);

      if (!resolvedRequesterId) {
        res.status(401).json({ message: "Missing user identity from token." });
        return;
      }

      if (!resolvedTargetId) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      if (resolvedRequesterId !== resolvedTargetId) {
        res.status(403).json({ message: "You can only delete your own user." });
        return;
      }

      const deleted = await UserService.deleteById(id);

      if (!deleted) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      res.status(200).json({ message: "User deleted successfully." });
    } catch (error: unknown) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to delete user", error);
      res.status(500).json({ message: "Unable to delete user." });
    }
  },

  updateName: async (req: UpdateUserNameRequest, res: Response) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { userId } = authRequest;
      const { firstName, lastName } = req.body;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "Missing user identity from token." });
      }

      if (!firstName || !lastName) {
        return res.status(400).json({
          message: "First name and last name are required.",
        });
      }

      const updatedUser = await UserService.updateName({
        userId,
        firstName,
        lastName,
      });

      res.status(200).json(updatedUser);
    } catch (error: unknown) {
      if (error instanceof UserServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to update user name", error);
      res.status(500).json({ message: "Unable to update user name." });
    }
  },
};
