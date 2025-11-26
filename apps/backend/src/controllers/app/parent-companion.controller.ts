import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../services/parent-companion.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { Types } from "mongoose";
import { ParentService } from "src/services/parent.service";
import type { ParentCompanionPermissions } from "@yosemite-crew/types";

// Resolve UserID
const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const ParentCompanionController = {
  getLinksForParent: async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;

      if (!Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({ message: "Invalid parent ID." });
      }

      const links = await ParentCompanionService.getLinksForParent(
        new Types.ObjectId(parentId),
      );
      return res.status(200).json({ links });
    } catch (error) {
      logger.error("Failed to get parent companion links", error);
      return res.status(500).json({ message: "Unable to fetch links." });
    }
  },

  getLinksForCompanion: async (req: Request, res: Response) => {
    try {
      const { companionId } = req.params;

      if (!Types.ObjectId.isValid(companionId)) {
        return res.status(400).json({ message: "Invalid companion ID." });
      }

      const links = await ParentCompanionService.getLinksForCompanion(
        new Types.ObjectId(companionId),
      );
      return res.status(200).json({ links });
    } catch (error) {
      logger.error("Failed to get companion links", error);
      return res.status(500).json({ message: "Unable to fetch links." });
    }
  },

  updatePermissions: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { companionId, targetParentId } = req.params;
      const updates = (
        typeof req.body === "object" && req.body ? req.body : {}
      ) as Partial<ParentCompanionPermissions>;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (
        !Types.ObjectId.isValid(companionId) ||
        !Types.ObjectId.isValid(targetParentId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      const updated = await ParentCompanionService.updatePermissions(
        new Types.ObjectId(requestingParent._id.toString()),
        new Types.ObjectId(targetParentId),
        new Types.ObjectId(companionId),
        updates,
      );

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof ParentCompanionServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to update permissions", error);
      return res.status(500).json({ message: "Unable to update permissions." });
    }
  },

  promoteToPrimary: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { companionId, targetParentId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (
        !Types.ObjectId.isValid(companionId) ||
        !Types.ObjectId.isValid(targetParentId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      const updated = await ParentCompanionService.promoteToPrimary(
        requestingParent._id,
        new Types.ObjectId(companionId),
        new Types.ObjectId(targetParentId),
      );

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof ParentCompanionServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to promote parent to primary", error);
      return res.status(500).json({ message: "Unable to promote to primary." });
    }
  },

  removeCoParent: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { companionId, coParentId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (
        !Types.ObjectId.isValid(companionId) ||
        !Types.ObjectId.isValid(coParentId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      await ParentCompanionService.removeCoParent(
        requestingParent._id,
        new Types.ObjectId(coParentId),
        new Types.ObjectId(companionId),
        false,
      );

      return res.status(204).send();
    } catch (error) {
      if (error instanceof ParentCompanionServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to remove co-parent", error);
      return res.status(500).json({ message: "Unable to remove co-parent." });
    }
  },
};
