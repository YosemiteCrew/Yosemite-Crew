import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  DeveloperExportService,
  DeveloperExportServiceError,
  EXPORTABLE_RESOURCES,
} from "src/services/developer-export.service";
import { InvalidCursorError, clampLimit } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";

// Management plane (session auth): submit and inspect bulk NDJSON exports of
// the organisation's data-plane resources. Same { data } / { data, pagination }
// / { message, code } envelopes as the sibling developer endpoints.

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const respondInvalid = (res: Response, message = "Invalid request"): Response =>
  res.status(400).json({ message, code: "invalid_request" });

const respondError = (
  res: Response,
  action: string,
  error: unknown,
): Response => {
  if (error instanceof DeveloperExportServiceError) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, code: error.code });
  }
  if (error instanceof InvalidCursorError) {
    return respondInvalid(res, "Invalid pagination cursor");
  }
  logger.error(`DeveloperExport ${action} failed`, { error });
  return res
    .status(500)
    .json({ message: "Internal server error", code: "internal_error" });
};

const CreateExportSchema = z.object({
  resources: z.array(z.enum(EXPORTABLE_RESOURCES)).min(1).max(6),
  format: z.literal("ndjson").default("ndjson"),
});

const ListQuery = z.object({
  limit: z.coerce.number().int().optional(),
  cursor: z.string().min(1).optional(),
});

export const DeveloperExportController = {
  createExport: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = CreateExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    try {
      const job = await DeveloperExportService.create({
        organisationId,
        resources: parsed.data.resources,
        format: parsed.data.format,
      });
      return res.status(202).json({ data: job });
    } catch (error) {
      return respondError(res, "create", error);
    }
  },

  listExports: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res, "Invalid query parameters");
    }
    try {
      const page = await DeveloperExportService.list({
        organisationId,
        limit: clampLimit(parsed.data.limit),
        cursor: parsed.data.cursor,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "list", error);
    }
  },

  getExport: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const job = await DeveloperExportService.get(
        organisationId,
        req.params.id,
      );
      if (!job) {
        return res
          .status(404)
          .json({ message: "Export not found", code: "not_found" });
      }
      return res.status(200).json({ data: job });
    } catch (error) {
      return respondError(res, "get", error);
    }
  },
};
