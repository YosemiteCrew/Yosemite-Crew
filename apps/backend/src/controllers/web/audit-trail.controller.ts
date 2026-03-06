import { Request, Response } from "express";
import {
  AuditEntityType,
  AuditEventType,
} from "src/models/audit-trail";
import {
  AuditTrailService,
  AuditTrailServiceError,
} from "src/services/audit-trail.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";

const parseListQuery = (req: Request) => {
  const limitRaw = req.query.limit;
  const beforeRaw = req.query.before;
  const eventTypesRaw = req.query.eventTypes;
  const entityTypesRaw = req.query.entityTypes;

  const limit =
    typeof limitRaw === "string" ? Number.parseInt(limitRaw, 10) : undefined;

  const before =
    typeof beforeRaw === "string" && beforeRaw.trim().length > 0
      ? new Date(beforeRaw)
      : undefined;
  const safeBefore =
    before && !Number.isNaN(before.getTime()) ? before : undefined;

  const eventTypes =
    typeof eventTypesRaw === "string" && eventTypesRaw.trim().length > 0
      ? (eventTypesRaw.split(",") as AuditEventType[])
      : undefined;

  const entityTypes =
    typeof entityTypesRaw === "string" && entityTypesRaw.trim().length > 0
      ? (entityTypesRaw.split(",") as AuditEntityType[])
      : undefined;

  return { limit, before: safeBefore, eventTypes, entityTypes };
};

export const AuditTrailController = {
  listForCompanion: async (
    req: Request<{ companionId: string }>,
    res: Response,
  ) => {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const { companionId } = req.params;

      if (!organisationId) {
        return res
          .status(400)
          .json({ message: "organisationId is required" });
      }

      if (!companionId) {
        return res.status(400).json({ message: "companionId is required" });
      }

      const { limit, before, eventTypes, entityTypes } = parseListQuery(req);

      const results = await AuditTrailService.listForOrganisation({
        organisationId,
        companionId,
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
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const { appointmentId } = req.params;

      if (!organisationId) {
        return res
          .status(400)
          .json({ message: "organisationId is required" });
      }

      if (!appointmentId) {
        return res
          .status(400)
          .json({ message: "appointmentId is required" });
      }

      const { limit, before } = parseListQuery(req);

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
