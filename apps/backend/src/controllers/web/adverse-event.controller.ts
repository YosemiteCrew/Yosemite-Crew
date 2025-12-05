// src/controllers/app/adverseEvent.controller.ts
import { Request, Response } from "express";
import type { AdverseEventReport, AdverseEventStatus } from "@yosemite-crew/types";
import {
  AdverseEventService,
  AdverseEventServiceError,
} from "../../services/adverse-event.service";
import logger from "src/utils/logger";
import { RegulatoryAuthorityModel } from "src/models/regulatory-authority";

export const AdverseEventController = {
  createFromMobile: async (
    req: Request<unknown, unknown, AdverseEventReport>,
    res: Response,
  ) => {
    try {
      const report = await AdverseEventService.createFromMobile(req.body);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof AdverseEventServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Error creating adverse event", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const report = await AdverseEventService.getById(req.params.id);
      if (!report) return res.status(404).json({ message: "Not found" });
      res.json(report);
    } catch (err) {
      logger.error("Error fetching adverse event by id", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  listForOrg: async (
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      { status?: AdverseEventStatus }
    >,
    res: Response,
  ) => {
    try {
      const { organisationId } = req.params;
      const { status } = req.query;
      const reports = await AdverseEventService.listForOrganisation(
        organisationId,
        { status },
      );
      res.json(reports);
    } catch (err) {
      logger.error("Error listing adverse events for org", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  updateStatus: async (
    req: Request<{ id: string }, unknown, { status: AdverseEventStatus }>,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await AdverseEventService.updateStatus(id, status);
      res.json(updated);
    } catch (err) {
      if (err instanceof AdverseEventServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Error updating adverse event status", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getRegulatoryAuthorityInof: async (
    req: Request<unknown, unknown, unknown, { country?: string; iso2?: string }>,
    res: Response,
  ) => {
    try {
      const iso2 = typeof req.query.iso2 === "string" ? req.query.iso2 : undefined;
      const country =
        typeof req.query.country === "string" ? req.query.country : undefined;

      const filters = [];

      if (iso2) filters.push({ iso2: iso2.toUpperCase() });
      if (country) filters.push({ country: new RegExp(`^${country}$`, "i") });

      if (filters.length === 0) {
        return res.status(400).json({ message: "country or iso2 is required" });
      }

      const record = await RegulatoryAuthorityModel.findOne({
        $or: filters,
      });

      if (!record) {
        return res.status(404).json({ message: "No regulatory authority found." });
      }

      res.json(record);
    } catch (err) {
      logger.error("Got error while retiving regulatory authority info", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
