import { Request, Response } from "express";
import { AuditEntityType, AuditEventType } from "src/models/audit-trail";
import {
  AuditTrailService,
  AuditTrailServiceError,
} from "src/services/audit-trail.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";

const parseListQuery = (payload: Record<string, unknown> | undefined) => {
  const limitRaw = payload?.limit;
  const beforeRaw = payload?.before;
  const eventTypesRaw = payload?.eventTypes;
  const entityTypesRaw = payload?.entityTypes;

  let limit: number | undefined;
  if (typeof limitRaw === "number") {
    limit = Math.floor(limitRaw);
  } else if (typeof limitRaw === "string") {
    limit = Number.parseInt(limitRaw, 10);
  }

  let before: Date | undefined;
  if (typeof beforeRaw === "string" && beforeRaw.trim().length > 0) {
    before = new Date(beforeRaw);
  } else if (beforeRaw instanceof Date) {
    before = beforeRaw;
  }
  const safeBefore =
    before && !Number.isNaN(before.getTime()) ? before : undefined;

  let eventTypes: AuditEventType[] | undefined;
  if (typeof eventTypesRaw === "string" && eventTypesRaw.trim().length > 0) {
    eventTypes = eventTypesRaw.split(",") as AuditEventType[];
  } else if (Array.isArray(eventTypesRaw)) {
    eventTypes = eventTypesRaw as AuditEventType[];
  }

  let entityTypes: AuditEntityType[] | undefined;
  if (typeof entityTypesRaw === "string" && entityTypesRaw.trim().length > 0) {
    entityTypes = entityTypesRaw.split(",") as AuditEntityType[];
  } else if (Array.isArray(entityTypesRaw)) {
    entityTypes = entityTypesRaw as AuditEntityType[];
  }

  return { limit, before: safeBefore, eventTypes, entityTypes };
};

export const AuditTrailController = {
  listForCompanion: async (
    req: Request<{ patientId: string }>,
    res: Response,
  ) => {
    try {
      if (req.method === "GET") {
        return res.status(405).json({
          message: "Use POST with patientId in request body.",
        });
      }
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const body = req.body as { patientId?: string } | undefined;
      const patientId =
        typeof body?.patientId === "string" ? body.patientId.trim() : "";

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required" });
      }

      if (!patientId) {
        return res.status(400).json({ message: "patientId is required" });
      }

      const { limit, before, eventTypes, entityTypes } = parseListQuery(
        req.body as Record<string, unknown> | undefined,
      );

      const results = await AuditTrailService.listForOrganisation({
        organisationId,
        patientId,
        limit,
        before,
        eventTypes,
        entityTypes,
      });

      return res.status(200).json(results);
    } catch (error) {
      if (error instanceof AuditTrailServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list audit trail entries", error);
      return res.status(500).json({ message: "Unable to fetch audit trail." });
    }
  },

  listForAppointment: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      if (req.method === "GET") {
        return res.status(405).json({
          message: "Use POST with appointmentId in request body.",
        });
      }
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const body = req.body as { appointmentId?: string } | undefined;
      const appointmentId =
        typeof body?.appointmentId === "string"
          ? body.appointmentId.trim()
          : "";

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required" });
      }

      if (!appointmentId) {
        return res.status(400).json({ message: "appointmentId is required" });
      }

      const { limit, before } = parseListQuery(
        req.body as Record<string, unknown> | undefined,
      );

      const results = await AuditTrailService.listForAppointment({
        organisationId,
        appointmentId,
        limit,
        before,
      });

      return res.status(200).json(results);
    } catch (error) {
      if (error instanceof AuditTrailServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list appointment audit trail entries", error);
      return res.status(500).json({ message: "Unable to fetch audit trail." });
    }
  },
};
