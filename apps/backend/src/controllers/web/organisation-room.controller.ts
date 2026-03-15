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

const requireParam = (
  res: Response,
  value: string | undefined,
  message: string,
): value is string => {
  if (!value) {
    res.status(400).json({ message });
    return false;
  }
  return true;
};

const handleServiceError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
) => {
  if (error instanceof OrganisationRoomServiceError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  logger.error(logMessage, error);
  res.status(500).json({ message: responseMessage });
};

const respondNotFound = (res: Response) => {
  res.status(404).json({ message: "Organisation room not found." });
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
      handleServiceError(
        res,
        error,
        "Failed to create organisation room",
        "Unable to create organisation room.",
      );
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = req.body as OrganisationRoomFHIRPayload | undefined;

      if (!requireParam(res, id, "Room identifier is required.")) {
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
        respondNotFound(res);
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to update organisation room",
        "Unable to update organisation room.",
      );
    }
  },

  getAllByOrganizationId: async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;

      if (
        !requireParam(
          res,
          organizationId,
          "Organization identifier is required.",
        )
      ) {
        return;
      }

      const resources =
        await OrganisationRoomService.getAllByOrganizationId(organizationId);
      res.status(200).json(resources);
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to retrieve organisation rooms",
        "Unable to retrieve organisation rooms.",
      );
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!requireParam(res, id, "Room identifier is required.")) {
        return;
      }

      const resource = await OrganisationRoomService.delete(id);

      if (!resource) {
        respondNotFound(res);
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to delete organisation room",
        "Unable to delete organisation room.",
      );
    }
  },
};
