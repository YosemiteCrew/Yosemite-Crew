import { Request, Response } from "express";
import { getAuthService } from "@yosemite-crew/auth";
import logger from "../../utils/logger";
import { UserService, UserServiceError } from "../../services/user.service";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { resolveUserIdFromRequest } from "src/utils/request";

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

// Names/role come from the signup form (request body) with the session as
// fallback; the session token no longer carries profile attributes.
function resolveProvisioningProfile(req: AuthenticatedRequest): {
  firstName?: string;
  lastName?: string;
  role?: string;
} {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const role = trimmedString(body.role);
  return {
    firstName: trimmedString(body.firstName) ?? req.firstName,
    lastName: trimmedString(body.lastName) ?? req.lastName,
    role: role && /^[a-z_-]{1,40}$/i.test(role) ? role : undefined,
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

      const user = await UserService.create({
        id: userId,
        email: email,
        firstName: profile.firstName!,
        lastName: profile.lastName!,
      });

      await syncProfileToAuthProvider(userId, profile);

      res.status(201).json(user);
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
      const requesterId = resolveUserIdFromRequest(req);
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "User id is required." });
      }

      if (!requesterId) {
        return res
          .status(401)
          .json({ message: "Missing user identity from token." });
      }

      if (requesterId !== id) {
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

      if (requesterId !== id) {
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
