import { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { MobilePrescriptionService } from "src/services/mobile-prescription.service";
import { resolveVerifiedUserId } from "src/utils/request";
import logger from "src/utils/logger";

/**
 * Resolves the caller to the parent their records hang off.
 *
 * Returns null and sends the response, so callers must return without writing
 * again. Kept separate from the handlers because every owner-facing read has to
 * do it, and doing it inline is how one of them ends up not doing it.
 */
const resolveParentId = async (
  req: Request,
  res: Response,
): Promise<string | null> => {
  const authUserId = resolveVerifiedUserId(req);
  if (!authUserId) {
    res.status(401).json({ message: "Not authenticated: userId is missing." });
    return null;
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);
  const parentId = authUser?.parentId?.toString();
  if (!parentId) {
    res.status(404).json({ message: "User not found." });
    return null;
  }

  return parentId;
};

export const MobilePrescriptionController = {
  listPrescriptions: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) {
        return;
      }

      const prescriptions =
        await MobilePrescriptionService.listPrescriptionsForParent(parentId);
      return res.status(200).json({ prescriptions });
    } catch (err) {
      logger.error(
        `Error listing prescriptions: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return res.status(500).json({ message: "Failed to list prescriptions." });
    }
  },
};
