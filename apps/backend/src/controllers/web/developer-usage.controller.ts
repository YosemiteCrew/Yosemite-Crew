import type { Request, Response } from "express";
import logger from "../../utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import { DeveloperUsageService } from "../../services/developer-usage.service";

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

export const DeveloperUsageController = {
  getUsage: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }
    const period =
      typeof req.query.period === "string" ? req.query.period : undefined;
    try {
      const data = await DeveloperUsageService.getUsage(organisationId, period);
      res.json({ data });
    } catch (err) {
      logger.error("DeveloperUsageController.getUsage failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
