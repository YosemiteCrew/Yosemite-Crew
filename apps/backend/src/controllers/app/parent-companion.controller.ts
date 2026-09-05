import { Request, Response } from "express";
import { z } from "zod";
import logger from "../../utils/logger";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../services/parent-companion.service";
import { ParentService } from "src/services/parent.service";
import type { ParentCompanionPermissions } from "@yosemite-crew/types";
import type { AuthenticatedRequest } from "src/middlewares/auth";

/*
 * `ParentPatient.permissions` is the input to an authorisation decision -
 * `companion-access.ts` reads it on every companion-gated route - so the body
 * that writes it is a trust boundary and gets parsed, not cast. A cast checks
 * nothing at runtime, and the previous one let any JSON object through to be
 * merged over the stored record verbatim (#2710).
 *
 * `satisfies` rather than a hand-kept list: adding a key to
 * `ParentCompanionPermissions` without adding it here, or leaving one here that
 * the type no longer has, is a compile error. The alternative is a list that
 * silently stops covering the feature someone added last week.
 */
const PERMISSION_SHAPE = {
  assignAsPrimaryParent: z.boolean(),
  emergencyBasedPermissions: z.boolean(),
  appointments: z.boolean(),
  companionProfile: z.boolean(),
  documents: z.boolean(),
  expenses: z.boolean(),
  tasks: z.boolean(),
  chatWithVet: z.boolean(),
  medicalRecords: z.boolean(),
} satisfies Record<keyof ParentCompanionPermissions, z.ZodBoolean>;

/*
 * Strict, so an unrecognised key is a 400 rather than a silent drop. A caller
 * who sends `medicalRecods: false` has made a mistake that matters, and
 * answering 200 to it would report a permission change that never happened.
 * Every key is optional because a PATCH may carry one.
 */
const permissionUpdateSchema = z.object(PERMISSION_SHAPE).partial().strict();

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
      const authUserId = resolveAuthenticatedUserId(req);
      const requestingParent = authUserId
        ? await ParentService.findByLinkedUserId(authUserId)
        : null;
      const { parentId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (!parentId || typeof parentId !== "string" || !parentId.trim()) {
        return res.status(400).json({ message: "Invalid parent ID." });
      }

      // The response carries the caller's companion links, so it is only released to the
      // parent it belongs to. Another parent's id is reported as missing rather than
      // forbidden, so the endpoint cannot confirm that an id exists.
      if (resolveParentId(requestingParent) !== parentId.trim()) {
        return res.status(404).json({ message: "Parent not found." });
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
      const authUserId = resolveAuthenticatedUserId(req);
      const requestingParent = await ParentService.findByLinkedUserId(
        authUserId!,
      );
      const { patientId } = req.params;

      if (!requestingParent) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
        return res.status(400).json({ message: "Invalid companion ID." });
      }

      const links =
        await ParentCompanionService.getLinksForCompanion(patientId);

      // The response carries every co-parent's contact details, so it is only
      // released to a parent who holds an ACTIVE link to the companion. A
      // companion the caller cannot see is reported as missing rather than
      // forbidden, so the endpoint cannot confirm that an id exists.
      const requestingParentId = resolveParentId(requestingParent);
      const isLinkedParent = links.some(
        (link) =>
          link.parentId === requestingParentId && link.status === "ACTIVE",
      );

      if (!isLinkedParent) {
        return res.status(404).json({ message: "Companion not found." });
      }

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

      /*
       * Parsed after the auth and id checks, so an unauthenticated caller
       * learns nothing about the body's shape. The offending body is not
       * logged - it is caller-controlled, and the 400 already reaches the only
       * party who can act on it.
       */
      const parsedUpdates = permissionUpdateSchema.safeParse(
        typeof req.body === "object" && req.body ? req.body : {},
      );
      if (!parsedUpdates.success) {
        return res.status(400).json({
          message: "Invalid permissions payload.",
          errors: z.flattenError(parsedUpdates.error),
        });
      }
      const updates: Partial<ParentCompanionPermissions> = parsedUpdates.data;

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
