import { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { MobilePrescriptionService } from "src/services/mobile-prescription.service";
import { resolveVerifiedUserId } from "src/utils/request";
import { parseKeysetCursor } from "src/services/shared/pagination";
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

      /*
       * Rejected up front rather than passed through. A malformed cursor is a
       * caller mistake and answering 400 keeps every failure from the query
       * itself honestly a 500; inferring "bad cursor" from a thrown error
       * would report a database outage as the caller's fault.
       *
       * The offending value is not logged. It is caller-controlled, a raw
       * CR/LF in it forges a second log line, and the 400 already tells the
       * only party who can act on it.
       */
      const cursor = parseKeysetCursor(req.query.cursor);
      if (cursor === null) {
        return res.status(400).json({
          message:
            "Unknown or malformed cursor. Use nextCursor from the previous response.",
        });
      }

      const page = await MobilePrescriptionService.listPrescriptionsForParent(
        parentId,
        { limit: req.query.limit, cursor },
      );

      /*
       * `prescriptions` keeps its name and its shape. The three fields beside
       * it are what stops this being a silently truncated list: a client that
       * ignores them sees a short page, and one that reads them can tell the
       * difference between the end of the data and the end of the page.
       */
      return res.status(200).json({
        prescriptions: page.prescriptions,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit: page.limit,
      });
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
