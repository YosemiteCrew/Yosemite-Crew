import type { Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import type {
  ServiceErrorClass,
  ServiceErrorLike,
} from "src/controllers/web/shared/clinical-controller.helpers";

/**
 * Ids on the passport-family routes may be Mongo ObjectIds or Postgres UUIDs
 * (dual-write), so validate leniently and let the data lookup decide existence.
 */
export const looseId = z.string().min(1).max(64);

/** Route params of an org-scoped patient endpoint. */
export const orgPatientParams = z.object({
  organisationId: looseId,
  patientId: looseId,
});

/**
 * Guards handlers that read `req.userPermissions` directly. Returns false and
 * writes a 500 when the route was mounted without `withOrgPermissions`.
 */
export const permissionsLoaded = (req: OrgRequest, res: Response): boolean => {
  if (req.userPermissions) return true;
  res.status(500).json({
    message:
      "Permissions not loaded. Include withOrgPermissions before handler.",
  });
  return false;
};

/**
 * Error handler for the passport-family controllers: known service errors keep
 * their status and message, anything else is logged and answered with a
 * generic 500.
 */
export const createOrgErrorHandler = (...errorClasses: ServiceErrorClass[]) => {
  const isServiceError = (err: unknown): err is ServiceErrorLike =>
    errorClasses.some((errorClass) => err instanceof errorClass);

  return (err: unknown, res: Response, context: string): Response => {
    if (isServiceError(err)) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    logger.error(context, err);
    return res.status(500).json({ message: "Internal Server Error" });
  };
};
