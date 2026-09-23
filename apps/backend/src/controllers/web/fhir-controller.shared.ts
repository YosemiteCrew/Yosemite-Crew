import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";

type ServiceErrorLike = Error & { statusCode: number };

type FhirErrorHandlerOptions = {
  isServiceError: (error: unknown) => error is ServiceErrorLike;
  invalidPayloadMessage: string;
  logMessage: string;
};

export const createFhirErrorHandler =
  ({
    isServiceError,
    invalidPayloadMessage,
    logMessage,
  }: FhirErrorHandlerOptions) =>
  (error: unknown, res: Response) => {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: invalidPayloadMessage,
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    logger.error(logMessage, error);
    return res.status(500).json({ message: "Internal Server Error" });
  };

/**
 * #3144 / #3496: the soft landing in this release accepts a clinical mutation that carries no
 * version precondition, so a tab still running the previous bundle keeps saving mid-consult.
 * #3496 makes the precondition mandatory, and its entry condition is "no header-less clinical
 * mutation for a full working day" - a count nothing else in the system produces. The branch that
 * accepts the degraded request is therefore the only place that can report it, and it has to ship
 * in THIS release: by the time #3496 is picked up, the window being measured has already passed.
 *
 * The marker is a fixed string so the entry condition is a log query rather than a code read. The
 * meta carries no identifiers: this line is written on every save from an old client, and the
 * concrete request path names a patient's artifact.
 */
export const UNVERSIONED_CLINICAL_MUTATION_MARKER =
  "Clinical mutation accepted with no version precondition";

export const logUnversionedClinicalMutation = (
  req: Request,
  operation: string,
) => {
  logger.warn(UNVERSIONED_CLINICAL_MUTATION_MARKER, {
    operation,
    method: req.method,
  });
};
