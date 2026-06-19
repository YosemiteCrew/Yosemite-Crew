import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../services/parent-companion.service";
import { ParentService } from "src/services/parent.service";
import type { ParentCompanionPermissions } from "@yosemite-crew/types";
import type { AuthenticatedRequest } from "src/middlewares/auth";

const resolveAuthenticatedUserId = (req: Request): string | undefined => {
  const userId = (req as AuthenticatedRequest).userId;
  if (typeof userId !== "string") return undefined;
  const trimmedUserId = userId.trim();
  return trimmedUserId || undefined;
};

const resolveParentId = (parent: { id?: string }): string => {
  if ("id" in parent && typeof parent.id === "string") return parent.id;
  throw new Error("Parent id missing");
};

export const ParentCompanionController = {
  getLinksForParent: async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;

      if (!parentId || typeof parentId !== "string" || !parentId.trim()) {
        return res.status(400).json({ message: "Invalid parent ID." });
      }

      const links = await ParentCompanionService.getLinksForParent(parentId);
      return res.status(200).json({ links });
    } catch (error) {
      logger.error("Failed to get parent companion links", error);
      return res.status(500).json({ message: "Unable to fetch links." });
    }
  },

  getLinksForCompanion: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
        return res.status(400).json({ message: "Invalid companion ID." });
      }

      const links =
        await ParentCompanionService.getLinksForCompanion(patientId);
      return res.status(200).json({ links });
    } catch (error) {
      logger.error("Failed to get companion links", error);
      return res.status(500).json({ message: "Unable to fetch links." });
    }
  },

  updatePermissions: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveAuthenticatedUserId(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { patientId, targetParentId } = req.params;
      const updates = (
        typeof req.body === "object" && req.body ? req.body : {}
      ) as Partial<ParentCompanionPermissions>;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (!patientId || !targetParentId) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      const updated = await ParentCompanionService.updatePermissions(
        resolveParentId(requestingParent),
        targetParentId,
        patientId,
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
      const authUserId = resolveAuthenticatedUserId(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { patientId, targetParentId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (!patientId || !targetParentId) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      const updated = await ParentCompanionService.promoteToPrimary(
        resolveParentId(requestingParent),
        patientId,
        targetParentId,
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
      const authUserId = resolveAuthenticatedUserId(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { patientId, coParentId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (!patientId || !coParentId) {
        return res
          .status(400)
          .json({ message: "Invalid parent or companion ID." });
      }

      await ParentCompanionService.removeCoParent(
        resolveParentId(requestingParent),
        coParentId,
        patientId,
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
