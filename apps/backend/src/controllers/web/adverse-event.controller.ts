// src/controllers/app/adverseEvent.controller.ts
import { Request, Response } from "express";
import {
  AdverseEventService,
  AdverseEventServiceError,
} from "../../services/adverse-event.service";
import logger from "src/utils/logger";
import { RegulatoryAuthorityModel } from "src/models/regulatory-authority";

export const AdverseEventController = {
  createFromMobile: async (req: Request, res: Response) => {
    try {
      // body should already be shaped like AdverseEventReport
      const report = await AdverseEventService.createFromMobile(req.body);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof AdverseEventServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Error creating adverse event", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const report = await AdverseEventService.getById(req.params.id);
      if (!report) return res.status(404).json({ message: "Not found" });
      res.json(report);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  listForOrg: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { status } = req.query;
      const reports = await AdverseEventService.listForOrganisation(
        organisationId,
        { status: status as string | undefined },
      );
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  updateStatus: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await AdverseEventService.updateStatus(id, status);
      res.json(updated);
    } catch (err) {
      if (err instanceof AdverseEventServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getRegulatoryAuthorityInof: async (req: Request, res: Response) => {
    try {
      const { country, iso2 } = req.query;

      const record = await RegulatoryAuthorityModel.findOne({
        $or: [
          { iso2: iso2?.toString().toUpperCase() },
          { country: new RegExp(`^${country}$`, "i") }
        ]
      });

      if (!record) {
        return res.status(404).json({ message: "No regulatory authority found." });
      }

      res.json(record);
    } catch (err) {
      logger.error("Got error while retiving regulatory authority info")
      res.status(500).json({ message: "Internal Server Error" });
    } 
  }
};