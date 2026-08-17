import type { Response } from "express";
import type { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import type {
  ServiceErrorClass,
  ServiceErrorLike,
} from "src/controllers/web/shared/clinical-controller.helpers";

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
