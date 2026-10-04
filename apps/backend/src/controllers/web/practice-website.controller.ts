import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  PracticeWebsiteError,
  PracticeWebsiteService,
  WEBSITE_TEMPLATE_IDS,
} from "src/services/practice-website.service";

/**
 * Authenticated editor surface for a practice's website.
 *
 * Scoped on the organisation `withOrgPermissions` authorized, never on the
 * route param. The copy fields end up on a public page, so each has a ceiling.
 */
const WebsiteSchema = z.object({
  templateId: z.enum(WEBSITE_TEMPLATE_IDS),
  headline: z.string().trim().min(1).max(120),
  tagline: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => value || null),
  about: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => value || null),
  published: z.boolean(),
});

const handleError = (context: string, error: unknown, res: Response) => {
  if (error instanceof PracticeWebsiteError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(context, error);
  return res.status(500).json({ message: "Something went wrong" });
};

const authorizedOrgId = (req: Request, res: Response): string | null => {
  const organisationId = (req as OrgRequest).organisationId;
  if (!organisationId) {
    res.status(400).json({ message: "Organisation could not be resolved" });
    return null;
  }
  return organisationId;
};

export const PracticeWebsiteController = {
  getConfig: async (req: Request, res: Response) => {
    try {
      const organisationId = authorizedOrgId(req, res);
      if (!organisationId) return;
      const data = await PracticeWebsiteService.getConfig(organisationId);
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("getPracticeWebsite error", error, res);
    }
  },

  saveConfig: async (req: Request, res: Response) => {
    try {
      const organisationId = authorizedOrgId(req, res);
      if (!organisationId) return;

      const parsed = WebsiteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      const data = await PracticeWebsiteService.saveConfig(
        organisationId,
        parsed.data,
      );
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("savePracticeWebsite error", error, res);
    }
  },
};

export default PracticeWebsiteController;
