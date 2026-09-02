import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  SuperAdminBusinessService,
  SuperAdminBusinessServiceError,
} from "src/services/super-admin-business.service";

const businessIdSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_.:-]+$/, "Invalid business id format."),
});

const updateBusinessSchema = z
  .object({
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const provided = ["isVerified", "isActive"].filter(
      (field) => value[field as keyof typeof value] !== undefined,
    );

    if (provided.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one status field is required.",
      });
    }
  });

const respondWithError = (
  res: Response,
  statusCode: number,
  code: string,
  error: string,
) => {
  res.status(statusCode).json({ error, code });
};

const handleServiceError = (
  error: unknown,
  res: Response,
  logMessage: string,
) => {
  if (error instanceof SuperAdminBusinessServiceError) {
    respondWithError(res, error.statusCode, error.code, error.message);
    return true;
  }

  logger.error(logMessage, error);
  return false;
};

const invalidIdResponse = (res: Response) =>
  respondWithError(
    res,
    400,
    "INVALID_BUSINESS_ID",
    "Invalid business id format.",
  );

const invalidUpdateResponse = (res: Response) =>
  respondWithError(
    res,
    400,
    "INVALID_BUSINESS_UPDATE",
    "Exactly one status field is required.",
  );

export const SuperAdminBusinessController = {
  listBusinesses: async (_req: Request, res: Response) => {
    try {
      const businesses = await SuperAdminBusinessService.listBusinesses();
      res.status(200).json({ businesses });
    } catch (error) {
      logger.error("Failed to list super-admin businesses", error);
      respondWithError(
        res,
        500,
        "SUPER_ADMIN_BUSINESS_LIST_FAILED",
        "Unable to list businesses.",
      );
    }
  },

  getBusiness: async (req: Request, res: Response) => {
    const parsed = businessIdSchema.safeParse(req.params);
    if (!parsed.success) {
      invalidIdResponse(res);
      return;
    }

    try {
      const business = await SuperAdminBusinessService.getBusiness(
        parsed.data.id,
      );
      if (!business) {
        respondWithError(res, 404, "BUSINESS_NOT_FOUND", "Business not found");
        return;
      }

      res.status(200).json({ business });
    } catch (error) {
      if (
        handleServiceError(error, res, "Failed to load super-admin business")
      ) {
        return;
      }
      respondWithError(
        res,
        500,
        "SUPER_ADMIN_BUSINESS_GET_FAILED",
        "Unable to load business.",
      );
    }
  },

  updateBusiness: async (req: Request, res: Response) => {
    const parsedParams = businessIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      invalidIdResponse(res);
      return;
    }

    const parsedBody = updateBusinessSchema.safeParse(req.body);
    if (!parsedBody.success) {
      invalidUpdateResponse(res);
      return;
    }

    try {
      const business = await SuperAdminBusinessService.updateBusiness(
        parsedParams.data.id,
        parsedBody.data,
      );

      if (!business) {
        respondWithError(res, 404, "BUSINESS_NOT_FOUND", "Business not found");
        return;
      }

      res.status(200).json({ business });
    } catch (error) {
      if (
        handleServiceError(error, res, "Failed to update super-admin business")
      ) {
        return;
      }
      respondWithError(
        res,
        500,
        "SUPER_ADMIN_BUSINESS_UPDATE_FAILED",
        "Unable to update business.",
      );
    }
  },
};
