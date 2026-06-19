import { Request, Response } from "express";
import {
  fromRoomUnitRequestDTO,
  toRoomUnitResponseDTO,
} from "@yosemite-crew/types";
import {
  RoomUnitService,
  RoomUnitServiceError,
} from "src/services/room-unit.service";
import {
  getOrganisationId,
  handleError,
  isLocationResourcePayload,
  requireParam,
} from "./room-unit.controller.shared";

export const RoomUnitController = {
  create: async (req: Request, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      if (!isLocationResourcePayload(rawBody)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }
      const payload = fromRoomUnitRequestDTO(
        rawBody as Parameters<typeof fromRoomUnitRequestDTO>[0],
      );
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const created = await RoomUnitService.create({
        ...payload,
        organisationId,
      });

      return res.status(201).json(toRoomUnitResponseDTO(created));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to create room unit.",
        RoomUnitServiceError,
      );
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      if (!isLocationResourcePayload(rawBody)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }
      const payload = fromRoomUnitRequestDTO(
        rawBody as Parameters<typeof fromRoomUnitRequestDTO>[0],
      );
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!requireParam(res, req.params.id, "Unit identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const updated = await RoomUnitService.update(req.params.id, {
        ...payload,
        organisationId,
      });

      return res.status(200).json(toRoomUnitResponseDTO(updated));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to update room unit.",
        RoomUnitServiceError,
      );
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const values = await RoomUnitService.list({
        organisationId:
          typeof req.query.organizationId === "string"
            ? req.query.organizationId
            : undefined,
        roomId:
          typeof req.query.roomId === "string" ? req.query.roomId : undefined,
        unitGroupId:
          typeof req.query.unitGroupId === "string"
            ? req.query.unitGroupId
            : undefined,
        isActive:
          typeof req.query.isActive === "string"
            ? req.query.isActive === "true"
            : undefined,
      });

      return res.status(200).json(values.map(toRoomUnitResponseDTO));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to list room units.",
        RoomUnitServiceError,
      );
    }
  },

  delete: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const organisationId = getOrganisationId(req);

      if (!requireParam(res, id, "Unit identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const deleted = await RoomUnitService.delete(id, organisationId);
      return res.status(200).json(toRoomUnitResponseDTO(deleted));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to delete room unit.",
        RoomUnitServiceError,
      );
    }
  },
};
