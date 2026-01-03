import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  SpecialityService,
  SpecialityServiceError,
  type SpecialityFHIRPayload,
} from "../../services/speciality.service";

const isFHIRSpecialityPayload = (
  payload: unknown,
): payload is SpecialityFHIRPayload => {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { resourceType?: string }).resourceType === "Organization",
  );
};

export const SpecialityController = {
  create: async (req: Request, res: Response) => {
    try {
      const payload = req.body as SpecialityFHIRPayload | undefined;

      if (!isFHIRSpecialityPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const { response, created } = await SpecialityService.createOne(payload);
      res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to create speciality", error);
      res.status(500).json({ message: "Unable to create speciality." });
    }
  },

  createMany: async (req: Request, res: Response) => {
    try {
      const payloads = req.body as SpecialityFHIRPayload[];

      if (
        !Array.isArray(payloads) ||
        !payloads.every(isFHIRSpecialityPayload)
      ) {
        res.status(400).json({
          message:
            "Invalid payload list. Expected array of FHIR Organization resources.",
        });
        return;
      }

      const resources = await SpecialityService.createMany(payloads);
      res.status(201).json(resources);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to create specialities", error);
      res.status(500).json({ message: "Unable to create specialities." });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = req.body as SpecialityFHIRPayload | undefined;

      if (!id) {
        res.status(400).json({ message: "Speciality identifier is required." });
        return;
      }

      if (!isFHIRSpecialityPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const resource = await SpecialityService.update(id, payload);

      if (!resource) {
        res.status(404).json({ message: "Speciality not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to update speciality", error);
      res.status(500).json({ message: "Unable to update speciality." });
    }
  },

  getSpecialityById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Speciality identifier is required." });
        return;
      }

      const resource = await SpecialityService.getById(id);

      if (!resource) {
        res.status(404).json({ message: "Speciality not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to retrieve speciality", error);
      res.status(500).json({ message: "Unable to retrieve speciality." });
    }
  },

  getAllByOrganizationId: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      if (!organisationId) {
        res
          .status(400)
          .json({ message: "Organization identifier is required." });
        return;
      }

      const resources =
        await SpecialityService.getAllByOrganizationId(organisationId);

      res.status(200).json(resources);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to retrieve specialities", error);
      res.status(500).json({ message: "Unable to retrieve specialities." });
    }
  },

  deleteSpeciality: async (req: Request, res: Response) => {
    try {
      const { organisationId, specialityId } = req.params;

      if (!organisationId || !specialityId) {
        res
          .status(400)
          .json({
            message:
              "Organization identifier and Speciality identifier is required.",
          });
        return;
      }

      const resources = await SpecialityService.deleteSpeciality(
        specialityId,
        organisationId,
      );

      res.status(200).json(resources);
    } catch (error) {
      if (error instanceof SpecialityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to delete speciality", error);
      res.status(500).json({ message: "Unable to delete speciality." });
    }
  },
};
