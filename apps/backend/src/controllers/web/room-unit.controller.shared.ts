import { Request, Response } from "express";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";

type ErrorConstructor<TError extends Error> = {
  new (...args: never[]): TError;
  prototype: TError;
};

export const requireParam = (
  res: Response,
  value: string | undefined,
  message: string,
): value is string => {
  if (!value) {
    res.status(400).json({ message });
    return false;
  }

  return true;
};

export const getOrganisationId = (
  req: Request,
  fallback?: string,
): string | undefined => (req as OrgRequest).organisationId ?? fallback;

export const handleError = <TError extends Error>(
  res: Response,
  error: unknown,
  fallback: string,
  errorType: ErrorConstructor<TError>,
) => {
  if (error instanceof errorType) {
    const typedError = error as TError & { statusCode?: number };
    return res
      .status(typedError.statusCode ?? 500)
      .json({ message: typedError.message });
  }

  logger.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

export const isLocationResourcePayload = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as { resourceType?: string }).resourceType === "Location",
  );
