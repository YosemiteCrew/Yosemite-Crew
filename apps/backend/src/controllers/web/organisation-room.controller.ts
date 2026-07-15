import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  fromFHIROrganisationRoom,
  toFHIROrganisationRoom,
  type OrganisationRoomRequestDTO,
} from "@yosemite-crew/types";
import {
  OrganisationRoomService,
  OrganisationRoomServiceError,
  type OrganisationRoomInput,
} from "../../services/organisation-room.service";
import { OrgRequest } from "src/middlewares/rbac";

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

const getOrganisationId = (
  req: Request,
  fallback?: string,
): string | undefined => (req as OrgRequest).organisationId ?? fallback;

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

const isRoomPayload = (value: unknown): value is OrganisationRoomRequestDTO =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as { resourceType?: string }).resourceType === "Location",
  );

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

export const OrganisationRoomController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!isRoomPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const payload = fromFHIROrganisationRoom(req.body);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const created = await OrganisationRoomService.create({
        ...payload,
        organisationId,
      } as Partial<OrganisationRoomInput>);

      return res.status(201).json(toFHIROrganisationRoom(created));
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to create organisation room",
        "Unable to create organisation room.",
      );
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;

      if (!requireParam(res, id, "Room identifier is required.")) {
        return;
      }

      if (!isRoomPayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const payload = fromFHIROrganisationRoom(req.body);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res
          .status(400)
          .json({ message: "Organization identifier is required." });
      }

      const updated = await OrganisationRoomService.update(id, {
        ...payload,
        organisationId,
      } as Partial<OrganisationRoomInput>);

      return res.status(200).json(toFHIROrganisationRoom(updated));
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
      const vacantOnly = parseBooleanQuery(req.query.vacantOnly);

      if (
        !requireParam(
          res,
          organizationId,
          "Organization identifier is required.",
        )
      ) {
        return;
      }

      const rooms =
        vacantOnly === undefined
          ? await OrganisationRoomService.getSummaryByOrganizationId(
              organizationId,
            )
          : await OrganisationRoomService.getSummaryByOrganizationId(
              organizationId,
              { vacantOnly },
            );

      return res.status(200).json(rooms.map(toFHIROrganisationRoom));
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to retrieve organisation rooms",
        "Unable to retrieve organisation rooms.",
      );
    }
  },

  getById: async (
    req: Request<{ organizationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const { organizationId, id } = req.params;

      if (
        !requireParam(
          res,
          organizationId,
          "Organization identifier is required.",
        ) ||
        !requireParam(res, id, "Room identifier is required.")
      ) {
        return;
      }

      const room = await OrganisationRoomService.getById(id, organizationId);
      return res.status(200).json(toFHIROrganisationRoom(room));
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to retrieve organisation room",
        "Unable to retrieve organisation room.",
      );
    }
  },

  toggleAvailability: async (
    req: Request<{ organizationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const { organizationId, id } = req.params;

      if (
        !requireParam(
          res,
          organizationId,
          "Organization identifier is required.",
        ) ||
        !requireParam(res, id, "Room identifier is required.")
      ) {
        return;
      }

      const room = await OrganisationRoomService.toggleAvailability(
        id,
        organizationId,
      );

      return res.status(200).json(toFHIROrganisationRoom(room));
    } catch (error) {
      handleServiceError(
        res,
        error,
        "Failed to toggle organisation room availability",
        "Unable to toggle organisation room availability.",
      );
    }
  },

  delete: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId } = req as OrgRequest;

      if (!requireParam(res, id, "Room identifier is required.")) {
        return;
      }

      if (
        !requireParam(
          res,
          organisationId,
          "Organization identifier is required.",
        )
      ) {
        return;
      }

      const deleted = await OrganisationRoomService.delete(id, organisationId);
      return res.status(200).json(toFHIROrganisationRoom(deleted));
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
