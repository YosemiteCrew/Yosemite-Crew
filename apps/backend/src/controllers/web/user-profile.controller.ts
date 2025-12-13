import { type Request, type Response } from "express";
import logger from "../../utils/logger";
import {
  UserProfileService,
  UserProfileServiceError,
  type CreateUserProfilePayload,
  type UpdateUserProfilePayload,
} from "../../services/user-profile.service";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { generatePresignedUrl } from "src/middlewares/upload";

function ensurePlainObjectBody(
  body: unknown,
): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new UserProfileServiceError("Invalid request body.", 400);
  }
}

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const UserProfileController = {
  create: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      const organizationId = req.params.organizationId;

      ensurePlainObjectBody(req.body);

      const profile = await UserProfileService.create({
        ...(req.body as CreateUserProfilePayload),
        userId,
        organizationId,
      });

      res.status(201).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to create user profile", error);
      res.status(500).json({ message: "Unable to create user profile." });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      const organizationId = req.params.organizationId;

      ensurePlainObjectBody(req.body);

      const profile = await UserProfileService.update(
        userId,
        organizationId,
        req.body as UpdateUserProfilePayload,
      );

      if (!profile) {
        return res.status(404).json({ message: "User profile not found." });
      }

      res.status(200).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to update user profile", error);
      res.status(500).json({ message: "Unable to update user profile." });
    }
  },

  getByUserId: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      const organizationId = req.params.organizationId;

      const profile = await UserProfileService.getByUserId(
        userId,
        organizationId,
      );

      if (!profile) {
        return res.status(404).json({ message: "User profile not found." });
      }

      res.status(200).json(profile);
    } catch (error: unknown) {
      if (error instanceof UserProfileServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to retrieve user profile", error);
      res.status(500).json({ message: "Unable to retrieve user profile." });
    }
  },

  getProfilePictureUploadUrl: async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const userId = resolveUserIdFromRequest(req);
      if (!organizationId ) {
        return res.status(400).json({
          message: "organizationId and userId are required in params",
        });
      }

      const rawBody: unknown = req.body;
      const mimeType =
        typeof rawBody === "object" && rawBody !== null && "mimeType" in rawBody
          ? (rawBody as { mimeType?: unknown }).mimeType
          : undefined;

      if (typeof mimeType !== "string" || !mimeType) {
        res
          .status(400)
          .json({ message: "MIME type is required in the request body." });
        return;
      }
      const { url, key } = await generatePresignedUrl(
        mimeType,
        "user-org",
        `${userId}-${organizationId}`,
      );
      res.status(200).json({ uploadUrl: url, s3Key: key });
    } catch (error) {
      logger.error("Failed to generate logo upload URL", error);
      res.status(500).json({ message: "Unable to generate logo upload URL." });
    }
  },
};
