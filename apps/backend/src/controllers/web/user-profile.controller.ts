import { type Request, type Response } from "express";
import logger from "../../utils/logger";
import {
  UserProfileService,
  UserProfileServiceError,
  type CreateUserProfilePayload,
  type UpdateUserProfilePayload,
} from "../../services/user-profile.service";

type CreateUserProfileRequest = Request<
  Record<string, never>,
  unknown,
  unknown
>;
type UpdateUserProfileRequest = Request<
  { organizationId: string; userId: string },
  unknown,
  unknown
>;
type GetUserProfileRequest = Request<{
  organizationId: string;
  userId: string;
}>;

function ensurePlainObjectBody(
  body: unknown,
): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new UserProfileServiceError("Invalid request body.", 400);
  }
}

export const UserProfileController = {
  create: async (req: CreateUserProfileRequest, res: Response) => {
    try {
      const requestBody: unknown = req.body;
      ensurePlainObjectBody(requestBody);

      const profile = await UserProfileService.create(
        requestBody as CreateUserProfilePayload,
      );
      res.status(201).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to create user profile", error);
      res.status(500).json({ message: "Unable to create user profile." });
    }
  },

  update: async (req: UpdateUserProfileRequest, res: Response) => {
    try {
      const requestBody: unknown = req.body;
      ensurePlainObjectBody(requestBody);

      const profile = await UserProfileService.update(
        req.params.userId,
        req.params.organizationId,
        requestBody as UpdateUserProfilePayload,
      );

      if (!profile) {
        res.status(404).json({ message: "User profile not found." });
        return;
      }

      res.status(200).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to update user profile", error);
      res.status(500).json({ message: "Unable to update user profile." });
    }
  },

  getByUserId: async (req: GetUserProfileRequest, res: Response) => {
    try {
      const profile = await UserProfileService.getByUserId(
        req.params.userId,
        req.params.organizationId,
      );

      if (!profile) {
        res.status(404).json({ message: "User profile not found." });
        return;
      }

      res.status(200).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to retrieve user profile", error);
      res.status(500).json({ message: "Unable to retrieve user profile." });
    }
  },
};
