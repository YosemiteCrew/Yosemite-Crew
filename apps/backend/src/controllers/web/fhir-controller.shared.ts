import { Response } from "express";
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
