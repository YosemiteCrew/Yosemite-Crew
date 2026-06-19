import { Request, Response } from "express";
import {
  fromFHIRRoomUnitGroup,
  toFHIRRoomUnitGroup,
} from "@yosemite-crew/types";
import {
  RoomUnitGroupService,
  RoomUnitGroupServiceError,
} from "src/services/room-unit-group.service";
import {
  getOrganisationId,
  handleError,
  isLocationResourcePayload,
  requireParam,
} from "./room-unit.controller.shared";

export const RoomUnitGroupController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!isLocationResourcePayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const dto = req.body as Parameters<typeof fromFHIRRoomUnitGroup>[0];
      const payload = fromFHIRRoomUnitGroup(dto);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const created = await RoomUnitGroupService.create({
        ...payload,
        organisationId,
      });

      return res.status(201).json(toFHIRRoomUnitGroup(created));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to create room unit group.",
        RoomUnitGroupServiceError,
      );
    }
  },

  update: async (req: Request<{ id: string }>, res: Response) => {
    try {
      if (!isLocationResourcePayload(req.body)) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR Location resource.",
        });
      }

      const dto = req.body as Parameters<typeof fromFHIRRoomUnitGroup>[0];
      const payload = fromFHIRRoomUnitGroup(dto);
      const organisationId = getOrganisationId(req, payload.organisationId);

      if (!requireParam(res, req.params.id, "Group identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const updated = await RoomUnitGroupService.update(req.params.id, {
        ...payload,
        organisationId,
      });

      return res.status(200).json(toFHIRRoomUnitGroup(updated));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to update room unit group.",
        RoomUnitGroupServiceError,
      );
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const values = await RoomUnitGroupService.list({
        organisationId:
          typeof req.query.organizationId === "string"
            ? req.query.organizationId
            : undefined,
        roomId:
          typeof req.query.roomId === "string" ? req.query.roomId : undefined,
        isActive:
          typeof req.query.isActive === "string"
            ? req.query.isActive === "true"
            : undefined,
      });

      return res.status(200).json(values.map(toFHIRRoomUnitGroup));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to list room unit groups.",
        RoomUnitGroupServiceError,
      );
    }
  },

  delete: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const organisationId = getOrganisationId(req);

      if (!requireParam(res, id, "Group identifier is required.")) {
        return;
      }

      if (!organisationId) {
        return res.status(400).json({
          message: "Organization identifier is required.",
        });
      }

      const deleted = await RoomUnitGroupService.delete(id, organisationId);
      return res.status(200).json(toFHIRRoomUnitGroup(deleted));
    } catch (error) {
      return handleError(
        res,
        error,
        "Failed to delete room unit group.",
        RoomUnitGroupServiceError,
      );
    }
  },
};
