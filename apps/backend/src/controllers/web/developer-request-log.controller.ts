import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  DeveloperRequestLogService,
  STATUS_CLASSES,
} from "src/services/developer-request-log.service";
import { InvalidCursorError, clampLimit } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";

// Management-plane read endpoint for the data-plane request logs
// (GET /v1/developers/request-logs). Session-authenticated like the sibling
// developer routers; responses reuse the { data, pagination } list envelope
// and the { message, code } error envelope.

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const ListQuery = z.object({
  limit: z.coerce.number().int().optional(),
  cursor: z.string().min(1).optional(),
  apiKeyId: z.string().min(1).optional(),
  statusClass: z.enum(STATUS_CLASSES).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const DeveloperRequestLogController = {
  listRequestLogs: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res
        .status(400)
        .json({
          message: "Missing organisation context",
          code: "invalid_request",
        });
    }
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid query parameters", code: "invalid_request" });
    }
    const { cursor, apiKeyId, statusClass, dateFrom, dateTo } = parsed.data;
    const limit = clampLimit(parsed.data.limit);
    try {
      const page = await DeveloperRequestLogService.list({
        organisationId,
        limit,
        cursor,
        apiKeyId,
        statusClass,
        dateFrom,
        dateTo,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        return res
          .status(400)
          .json({
            message: "Invalid pagination cursor",
            code: "invalid_request",
          });
      }
      logger.error("DeveloperRequestLog list failed", { error });
      return res
        .status(500)
        .json({ message: "Internal server error", code: "internal_error" });
    }
  },
};
