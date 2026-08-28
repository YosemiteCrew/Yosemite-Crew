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
      await authService.setUserRole(userId, profile.role);
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
      let user: Awaited<ReturnType<typeof UserService.create>>;
      let created = true;
      try {
        user = await UserService.create({
          id: userId,
          email: email,
          firstName: profile.firstName!,
          lastName: profile.lastName!,
        });
      } catch (error: unknown) {
        const alreadyProvisioned =
          error instanceof UserServiceError && error.statusCode === 409;
        if (!alreadyProvisioned) {
          throw error;
        }

        const existing = await UserService.getById(userId);
        // A 409 means a row matched on id OR email. If it matched on email
        // alone the row belongs to a different id, and serving it here would
        // hand this caller another user's record - rethrow instead.
        if (!existing) {
          throw error;
        }

        user = existing;
        created = false;
      }

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
