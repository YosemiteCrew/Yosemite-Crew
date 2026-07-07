import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import { DeveloperDataService } from "src/services/developer-data.service";
import { DeveloperUsageService } from "src/services/developer-usage.service";
import { InvalidCursorError, clampLimit } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";

// Developer Data API v1 (contract: docs/plans/developer-portal-data-api.md).
// The controller owns query validation (Zod), the response envelopes, and the
// error status codes; all Prisma access lives in DeveloperDataService, which
// scopes every query to the verified key's organisationId. 404s never reveal
// whether a row exists in another org.

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const respondInvalid = (
  res: Response,
  message = "Invalid query parameters",
): Response => res.status(400).json({ message, code: "invalid_request" });

const respondNotFound = (res: Response): Response =>
  res.status(404).json({ message: "Resource not found", code: "not_found" });

const respondError = (
  res: Response,
  action: string,
  error: unknown,
): Response => {
  if (error instanceof InvalidCursorError) {
    return respondInvalid(res, "Invalid pagination cursor");
  }
  logger.error(`DeveloperData ${action} failed`, { error });
  return res
    .status(500)
    .json({ message: "Internal server error", code: "internal_error" });
};

const ListQueryBase = z.object({
  limit: z.coerce.number().int().optional(),
  cursor: z.string().min(1).optional(),
});

const DateRangeQuery = z.object({
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

const AppointmentListQuery = ListQueryBase.extend({
  status: z
    .enum([
      "REQUESTED",
      "UPCOMING",
      "CHECKED_IN",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ])
    .optional(),
}).merge(DateRangeQuery);

const PatientListQuery = ListQueryBase.extend({
  status: z.enum(["active", "archived", "inactive"]).optional(),
});

const EncounterListQuery = ListQueryBase.extend({
  status: z.string().min(1).optional(),
  patientId: z.string().min(1).optional(),
  caseId: z.string().min(1).optional(),
}).merge(DateRangeQuery);

const InvoiceListQuery = ListQueryBase.extend({
  status: z
    .enum([
      "PENDING",
      "AWAITING_PAYMENT",
      "PAID",
      "FAILED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional(),
  patientId: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional(),
}).merge(DateRangeQuery);

export const DeveloperDataController = {
  listAppointments: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = AppointmentListQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    const { cursor, status, dateFrom, dateTo } = parsed.data;
    const limit = clampLimit(parsed.data.limit);
    try {
      const page = await DeveloperDataService.listAppointments({
        organisationId,
        limit,
        cursor,
        status,
        dateFrom,
        dateTo,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "listAppointments", error);
    }
  },

  getAppointment: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const row = await DeveloperDataService.getAppointment(
        organisationId,
        req.params.id,
      );
      if (!row) {
        return respondNotFound(res);
      }
      return res.status(200).json({ data: row });
    } catch (error) {
      return respondError(res, "getAppointment", error);
    }
  },

  listPatients: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = PatientListQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    const { cursor, status } = parsed.data;
    const limit = clampLimit(parsed.data.limit);
    try {
      const page = await DeveloperDataService.listPatients({
        organisationId,
        limit,
        cursor,
        status,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "listPatients", error);
    }
  },

  getPatient: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const patient = await DeveloperDataService.getPatient(
        organisationId,
        req.params.id,
      );
      if (!patient) {
        return respondNotFound(res);
      }
      return res.status(200).json({ data: patient });
    } catch (error) {
      return respondError(res, "getPatient", error);
    }
  },

  listEncounters: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = EncounterListQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    const { cursor, status, patientId, caseId, dateFrom, dateTo } = parsed.data;
    const limit = clampLimit(parsed.data.limit);
    try {
      const page = await DeveloperDataService.listEncounters({
        organisationId,
        limit,
        cursor,
        status,
        patientId,
        caseId,
        dateFrom,
        dateTo,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "listEncounters", error);
    }
  },

  getEncounter: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const row = await DeveloperDataService.getEncounter(
        organisationId,
        req.params.id,
      );
      if (!row) {
        return respondNotFound(res);
      }
      return res.status(200).json({ data: row });
    } catch (error) {
      return respondError(res, "getEncounter", error);
    }
  },

  listInvoices: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    const parsed = InvoiceListQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    const { cursor, status, patientId, appointmentId, dateFrom, dateTo } =
      parsed.data;
    const limit = clampLimit(parsed.data.limit);
    try {
      const page = await DeveloperDataService.listInvoices({
        organisationId,
        limit,
        cursor,
        status,
        patientId,
        appointmentId,
        dateFrom,
        dateTo,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "listInvoices", error);
    }
  },

  getInvoice: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const row = await DeveloperDataService.getInvoice(
        organisationId,
        req.params.id,
      );
      if (!row) {
        return respondNotFound(res);
      }
      return res.status(200).json({ data: row });
    } catch (error) {
      return respondError(res, "getInvoice", error);
    }
  },

  getOrganization: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const org = await DeveloperDataService.getOrganization(organisationId);
      if (!org) {
        return respondNotFound(res);
      }
      return res.status(200).json({ data: org });
    } catch (error) {
      return respondError(res, "getOrganization", error);
    }
  },

  getUsage: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondInvalid(res, "Missing organisation context");
    }
    try {
      const usage = await DeveloperUsageService.getUsage(organisationId);
      return res.status(200).json({ data: usage });
    } catch (error) {
      return respondError(res, "getUsage", error);
    }
  },
};
