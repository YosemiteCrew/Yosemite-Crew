import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  OrganisationRoomService,
  OrganisationRoomServiceError,
  type OrganisationRoomFHIRPayload,
} from "../../services/organisation-room.service";

const isFHIRLocationPayload = (
  payload: unknown,
): payload is OrganisationRoomFHIRPayload => {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { resourceType?: string }).resourceType === "Location",
  );
};

export const OrganisationRoomController = {
  create: async (req: Request, res: Response) => {
    try {
      const payload = req.body as OrganisationRoomFHIRPayload | undefined;

      if (!isFHIRLocationPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
        return;
      }

      const { response, created } =
        await OrganisationRoomService.create(payload);
      res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof OrganisationRoomServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to create organisation room", error);
      res.status(500).json({ message: "Unable to create organisation room." });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = req.body as OrganisationRoomFHIRPayload | undefined;

      if (!id) {
        res.status(400).json({ message: "Room identifier is required." });
        return;
      }

      if (!isFHIRLocationPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
        return;
      }

      const resource = await OrganisationRoomService.update(id, payload);

      if (!resource) {
        res.status(404).json({ message: "Organisation room not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof OrganisationRoomServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to update organisation room", error);
      res.status(500).json({ message: "Unable to update organisation room." });
    }
  },

  getAllByOrganizationId: async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (!organizationId) {
        res
          .status(400)
          .json({ message: "Organization identifier is required." });
        return;
      }

      const resources =
        await OrganisationRoomService.getAllByOrganizationId(organizationId);
      res.status(200).json(resources);
    } catch (error) {
      if (error instanceof OrganisationRoomServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to retrieve organisation rooms", error);
      res
        .status(500)
        .json({ message: "Unable to retrieve organisation rooms." });
    }
  },
};
