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

type AuthServiceForSync = NonNullable<ReturnType<typeof getAuthService>>;

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
  /*
   * Grant before revoking, never the other way round. The whole sync is
   * best-effort - the caller logs a provider failure and still answers 2xx, so
   * the client accepts it and does not retry. Removing first and then failing
   * would leave the account with NO role behind a successful response, which
   * is worse than the problem this fixes. Failing after the grant leaves it
   * holding both, which is exactly the append-only state this replaced:
   * recoverable, and repaired by the next call.
   */
  await authService.setUserRole(userId, role);
  const replaced = [...SELF_ASSIGNABLE_ROLES].filter(
    (candidate) => candidate !== role,
  );
  for (const candidate of replaced) {
    await authService.removeUserRole(userId, candidate);
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
  try {
    return await UserService.updateName({
      userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  } catch (nameError) {
    /*
     * A rejected name is the caller's problem, not an outage: `updateName`
     * raises UserServiceError for a name the service will not accept, and
     * creation rejects the same payload outright. Swallowing it would answer
     * 200 to a rename that was refused, and let the sync push the refused name
     * into the provider anyway.
     */
    if (nameError instanceof UserServiceError) {
      throw nameError;
    }

    /*
     * Anything else is infrastructure. `updateName` pushes the name to the auth
     * provider BEFORE its database write, unguarded, so a provider outage would
     * fail a request whose entire purpose is to be repeatable - while the sync
     * beside it stays best-effort for exactly that reason.
     *
     * Both stores are deliberately left untouched rather than forcing the
     * database write through on its own: that would put the two out of step,
     * and `updateName` no-ops once the database matches, so no later call could
     * repair the provider side. Unchanged is recoverable; half-applied is not.
     */
    logger.warn(
      "Could not reconcile stored names during provisioning",
      nameError,
    );
    return stored!;
  }
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
  try {
    if (profile.firstName && profile.lastName) {
      await authService.updateUserName(userId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    }
    if (profile.role) {
      await applyRole(authService, userId, profile.role);
    }
  } catch (syncError) {
    logger.warn("Auth provider profile sync failed", syncError);
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

      /*
       * A repeat call may legitimately carry no names at all: once
       * `pendingSignUp` is gone the client posts no body, and the session
       * carries no profile attributes either. Carrying exactly one name is not
       * that - it is a malformed request, which `UserService.create` rejects on
       * the creation path. Reject it here too, rather than letting the repeat
       * path read it as "no names supplied" and answer 200 to a rename that
       * never happened.
       */
      if (Boolean(profile.firstName) !== Boolean(profile.lastName)) {
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

      const { user, created } = provisioned
        ? {
            user: await reconcileNames(userId, provisioned, profile),
            created: false,
          }
        : await createOrAdopt(userId, email, profile);

      await syncProfileToAuthProvider(userId, profile);

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
