/*
 * These routes are scoped to the DEVELOPER, not to a practice.
 *
 * They were gated on `withOrgPermissions()` and keyed on an organisation, which
 * the portal's own audience never has: signing up through the developer door
 * grants the `developer` role and nothing else, there is no developer entry in
 * the RBAC role model, and no UserOrganization row is created. Every request
 * from such an account failed on the org middleware before reaching a handler.
 * See issue #2551.
 *
 * The caller's own verified id is the owner. `resolveVerifiedUserId` reads only
 * the session (`utils/request.ts` deliberately dropped its `x-user-id` header
 * fallback), so the owner cannot be spoofed by a header the way an org could be.
 */
import type { Request, Response } from "express";
import logger from "../../utils/logger";
import { resolveVerifiedUserId } from "src/utils/request";
import { DeveloperUsageService } from "../../services/developer-usage.service";

export const DeveloperUsageController = {
  getUsage: async (req: Request, res: Response): Promise<void> => {
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const period =
      typeof req.query.period === "string" ? req.query.period : undefined;
    try {
      const data = await DeveloperUsageService.getUsage(ownerUserId, period);
      res.json({ data });
    } catch (err) {
      logger.error("DeveloperUsageController.getUsage failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
