/*
 * Handlers for the developer data plane (`/v1/developer`), the API-key
 * authenticated read surface.
 *
 * Identity comes from `resolveVerifiedUserId` and the acting practice from
 * `resolveVerifiedOrganisationId`; both read values the middleware chain wrote
 * after verifying them, never a header. A handler that reached for
 * `req.headers["x-org-id"]` directly would bypass the live membership check
 * that makes this surface safe, so neither is read here.
 *
 * Errors use the `{ message, code }` envelope the published client libraries
 * parse. The codes are a closed set: adding one is a contract change.
 */
import type { Request, Response } from "express";
import { AppointmentStatus } from "@prisma/client";
import logger from "../../utils/logger";
import {
  resolveVerifiedOrganisationId,
  resolveVerifiedUserId,
} from "src/utils/request";
import {
  clampPageSize,
  DeveloperDataService,
} from "../../services/developer-data.service";
import { DeveloperUsageService } from "../../services/developer-usage.service";

type ErrorCode =
  "invalid_request" | "missing_api_key" | "not_found" | "internal_error";

const fail = (
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
) => res.status(status).json({ message, code });

/*
 * Strip CR/LF before any user-controlled value reaches the log, so a crafted
 * query parameter cannot forge a second log line. No quantifier and an empty
 * replacement: this is the exact form CodeQL recognises as a barrier for
 * js/log-injection.
 */
const forLog = (value: string): string => value.replace(/[\n\r]/g, "");

const parseDate = (raw: unknown): Date | undefined | null => {
  if (typeof raw !== "string" || !raw) {
    return undefined;
  }
  const parsed = new Date(raw);
  // null is the "present but unparseable" signal, distinct from absent.
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/*
 * Cursors are appointment ids, which are uuids. Checking the shape up front is
 * what lets every failure from the query itself be reported honestly as a 500:
 * the alternative, inferring "bad cursor" from a thrown error, turns a database
 * outage into a 400 telling the caller their cursor is malformed.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseCursor = (raw: unknown): string | undefined | null => {
  if (typeof raw !== "string" || !raw) {
    return undefined;
  }
  return UUID.test(raw) ? raw : null;
};

const parseStatus = (raw: unknown): AppointmentStatus | undefined | null => {
  if (typeof raw !== "string" || !raw) {
    return undefined;
  }
  const candidate = raw.toUpperCase();
  const isKnown = Object.values(AppointmentStatus).includes(
    candidate as AppointmentStatus,
  );
  return isKnown ? (candidate as AppointmentStatus) : null;
};

export const DeveloperDataController = {
  listOrganizations: async (req: Request, res: Response): Promise<void> => {
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      fail(res, 401, "missing_api_key", "API key required");
      return;
    }

    try {
      const data = await DeveloperDataService.listOrganizations(ownerUserId);
      res.json({ data });
    } catch (err) {
      logger.error("DeveloperDataController.listOrganizations failed", err);
      fail(res, 500, "internal_error", "Internal server error");
    }
  },

  getUsage: async (req: Request, res: Response): Promise<void> => {
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      fail(res, 401, "missing_api_key", "API key required");
      return;
    }

    try {
      const data = await DeveloperUsageService.getUsage(ownerUserId);
      res.json({ data });
    } catch (err) {
      logger.error("DeveloperDataController.getUsage failed", err);
      fail(res, 500, "internal_error", "Internal server error");
    }
  },

  listAppointments: async (req: Request, res: Response): Promise<void> => {
    const organisationId = resolveVerifiedOrganisationId(req);
    if (!organisationId) {
      fail(res, 400, "invalid_request", "Missing organisation context");
      return;
    }

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from === null || to === null) {
      fail(
        res,
        400,
        "invalid_request",
        "from and to must be ISO 8601 date-times",
      );
      return;
    }

    const status = parseStatus(req.query.status);
    if (status === null) {
      fail(
        res,
        400,
        "invalid_request",
        `status must be one of: ${Object.values(AppointmentStatus).join(", ")}`,
      );
      return;
    }

    const limit = clampPageSize(req.query.limit);
    /*
     * Narrowed here rather than inside the log call: a query value can be an
     * object or an array, and stringifying one would put "[object Object]" in
     * the log instead of what the caller actually sent.
     */
    const rawCursor =
      typeof req.query.cursor === "string" ? req.query.cursor : "";
    const cursor = parseCursor(req.query.cursor);
    if (cursor === null) {
      // Logged newline-stripped: the value is caller-controlled and a raw CR/LF
      // in it would forge a second log line.
      logger.warn(
        `DeveloperDataController.listAppointments rejected cursor ${forLog(rawCursor)}`,
      );
      fail(
        res,
        400,
        "invalid_request",
        "Unknown or malformed cursor. Use pagination.nextCursor from the previous response.",
      );
      return;
    }

    try {
      const page = await DeveloperDataService.listAppointments({
        organisationId,
        limit,
        cursor,
        from,
        to,
        status,
      });
      res.json({
        data: page.items,
        pagination: { limit, nextCursor: page.nextCursor },
      });
    } catch (err) {
      logger.error("DeveloperDataController.listAppointments failed", err);
      fail(res, 500, "internal_error", "Internal server error");
    }
  },

  getAppointment: async (req: Request, res: Response): Promise<void> => {
    const organisationId = resolveVerifiedOrganisationId(req);
    const appointmentId = req.params.appointmentId;
    if (!organisationId || !appointmentId) {
      fail(res, 400, "invalid_request", "Missing organisation context");
      return;
    }

    try {
      const data = await DeveloperDataService.getAppointment(
        organisationId,
        appointmentId,
      );
      if (!data) {
        fail(res, 404, "not_found", "Appointment not found");
        return;
      }
      res.json({ data });
    } catch (err) {
      logger.error("DeveloperDataController.getAppointment failed", err);
      fail(res, 500, "internal_error", "Internal server error");
    }
  },
};
