import { z } from "zod";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import logger from "src/utils/logger";
import {
  PatientDuplicateReviewError,
  PatientDuplicateReviewService,
} from "src/services/patient-duplicate-review.service";

const OrganisationParams = z.object({
  organisationId: z.string().trim().min(1),
});

const DismissParams = OrganisationParams.extend({
  patientAId: z.uuid(),
  patientBId: z.uuid(),
});

const respondWithError = (res: Response, error: unknown, operation: string) => {
  if (error instanceof PatientDuplicateReviewError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(`Unable to ${operation}`, error);
  return res.status(500).json({ message: "Unable to review patient records." });
};

export const PatientDuplicateReviewController = {
  list: async (req: Request, res: Response) => {
    const params = OrganisationParams.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: "Organisation is required." });
    }
    try {
      const matches = await PatientDuplicateReviewService.list(
        params.data.organisationId,
      );
      return res.status(200).json({ matches });
    } catch (error) {
      return respondWithError(res, error, "load possible matches");
    }
  },

  dismiss: async (req: Request, res: Response) => {
    const params = DismissParams.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: "Patient records are required." });
    }
    const dismissedById = (req as AuthenticatedRequest).userId?.trim();
    if (!dismissedById) {
      return res.status(401).json({ message: "Authentication is required." });
    }
    try {
      const result = await PatientDuplicateReviewService.dismiss({
        ...params.data,
        dismissedById,
      });
      return res.status(200).json(result);
    } catch (error) {
      return respondWithError(res, error, "dismiss the possible match");
    }
  },
};
