// src/middlewares/require-active-account.ts
import { NextFunction, Request, Response } from "express";

import { prisma } from "src/config/prisma";
import { AuthenticatedRequest } from "./auth";
import logger from "src/utils/logger";

/**
 * Refuse a request whose session belongs to an account that has been deleted.
 *
 * `UserService.deleteById` soft-deletes: it sets `isActive: false` and removes
 * the organisation memberships, but it cannot revoke the provider session, and
 * the session middleware does not consult the flag. Every org-gated route was
 * incidentally covered by that membership removal - `withOrgPermissions()`
 * answers 403 once the rows are gone. The developer routes are scoped to the
 * user rather than to an organisation, so they have no such cover and need the
 * check stated explicitly.
 *
 * Revoking the session itself at deletion time is the broader fix and belongs
 * with the auth boundary, which exposes no revocation call today.
 */
export const requireActiveAccount = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const user = await prisma.user.findFirst({
        where: { userId },
        select: { isActive: true },
      });

      if (!user?.isActive) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      return next();
    } catch (err) {
      logger.error("Failed to resolve the account state for a request", {
        err,
      });
      return res.status(500).json({ error: "Failed to resolve the account" });
    }
  };
};
