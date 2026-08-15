import { Response } from "express";
import logger from "src/utils/logger";
import { LabOrderServiceError } from "src/services/lab-order.service";

type LabOrderErrorEnvelope = {
  error?: { code?: string; details?: Record<string, unknown> };
};

const buildErrorEnvelope = (
  error: LabOrderServiceError,
): LabOrderErrorEnvelope => {
  if (!error.code && !error.details) return {};
  const envelope: { code?: string; details?: Record<string, unknown> } = {};
  if (error.code) envelope.code = error.code;
  if (error.details) envelope.details = error.details;
  return { error: envelope };
};

export const respondLabOrderServiceError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
): Response => {
  if (error instanceof LabOrderServiceError) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...buildErrorEnvelope(error),
    });
  }
  logger.error(logMessage, error);
  return res.status(500).json({ message: responseMessage });
};
