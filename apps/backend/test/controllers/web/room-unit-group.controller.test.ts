import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { RoomUnitGroupController } from "../../../src/controllers/web/room-unit-group.controller";
import {
  RoomUnitGroupService,
  RoomUnitGroupServiceError,
} from "../../../src/services/room-unit-group.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/room-unit-group.service", () => ({
  RoomUnitGroupService: {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  },
  RoomUnitGroupServiceError: class RoomUnitGroupServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "RoomUnitGroupServiceError";
    }
  },
}));

jest.mock("../../../src/utils/logger");

const mockedService = jest.mocked(RoomUnitGroupService);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

const locationPayload = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  resourceType: "Location",
  name: "Dog ward",
  managingOrganization: { reference: "Organization/org_1" },
  partOf: { reference: "Location/room_1" },
  extension: [
    {
      url: "https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-count",
      valueInteger: 2,
    },
  ],
  ...overrides,
});

const fullGroup = {
  id: "group_1",
  organisationId: "org_1",
  roomId: "room_1",
  name: "Dog ward",
  unitCount: 2,
  isActive: true,
};

describe("RoomUnitGroupController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  describe("create", () => {
    it("creates a room unit group and returns the FHIR resource", async () => {
      req.body = locationPayload();
      mockedService.create.mockResolvedValue(fullGroup as never);

      await RoomUnitGroupController.create(req as any, res as any);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_1",
          roomId: "room_1",
          name: "Dog ward",
          unitCount: 2,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: "Location",
          id: "group_1",
          name: "Dog ward",
        }),
      );
    });

    it("uses the request organisation id as a fallback source", async () => {
      req.body = locationPayload({ managingOrganization: undefined });
      mockedService.create.mockResolvedValue(fullGroup as never);

      await RoomUnitGroupController.create(
        { ...req, organisationId: "org_req" } as any,
        res as any,
      );

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: "org_req" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("rejects a non-Location payload with 400", async () => {
      req.body = { resourceType: "Observation" };

      await RoomUnitGroupController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Location resource.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id can be resolved", async () => {
      req.body = locationPayload({ managingOrganization: undefined });

      await RoomUnitGroupController.create(
        { ...req, organisationId: undefined } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitGroupServiceError to its status code", async () => {
      req.body = locationPayload();
      mockedService.create.mockRejectedValue(
        new RoomUnitGroupServiceError(
          "Organisation room not found.",
          404,
        ) as never,
      );

      await RoomUnitGroupController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation room not found.",
      });
    });

    it("maps an unexpected error to 500 and logs it", async () => {
      req.body = locationPayload();
      mockedService.create.mockRejectedValue(new Error("boom") as never);

      await RoomUnitGroupController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to create room unit group.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates a room unit group when the payload organisation matches", async () => {
      req.body = locationPayload();
      mockedService.update.mockResolvedValue(fullGroup as never);

      await RoomUnitGroupController.update(
        {
          ...req,
          params: { id: "group_1" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "group_1",
        "org_1",
        expect.objectContaining({ organisationId: "org_1", roomId: "room_1" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: "Location", id: "group_1" }),
      );
    });

    it("updates when the payload carries no organisation id", async () => {
      req.body = locationPayload({ managingOrganization: undefined });
      mockedService.update.mockResolvedValue(fullGroup as never);

      await RoomUnitGroupController.update(
        {
          ...req,
          params: { id: "group_1" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "group_1",
        "org_1",
        expect.objectContaining({ organisationId: "" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects a non-Location payload with 400", async () => {
      req.body = { resourceType: "Observation" };

      await RoomUnitGroupController.update(
        { ...req, params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Location resource.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the group id param is missing", async () => {
      req.body = locationPayload();

      await RoomUnitGroupController.update(
        { ...req, params: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Group identifier is required.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id is present", async () => {
      req.body = locationPayload({ managingOrganization: undefined });

      await RoomUnitGroupController.update(
        { ...req, params: { id: "group_1" }, organisationId: undefined } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("returns 403 when the payload organisation does not match", async () => {
      req.body = locationPayload({
        managingOrganization: { reference: "Organization/org_2" },
      });

      await RoomUnitGroupController.update(
        { ...req, params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Organization identifier does not match the authorized organisation.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitGroupServiceError to its status code", async () => {
      req.body = locationPayload();
      mockedService.update.mockRejectedValue(
        new RoomUnitGroupServiceError(
          "Room unit group not found.",
          404,
        ) as never,
      );

      await RoomUnitGroupController.update(
        { ...req, params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Room unit group not found.",
      });
    });

    it("maps an unexpected error to 500 and logs it", async () => {
      req.body = locationPayload();
      mockedService.update.mockRejectedValue(new Error("kaboom") as never);

      await RoomUnitGroupController.update(
        { ...req, params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to update room unit group.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("lists room unit groups with no filters", async () => {
      mockedService.list.mockResolvedValue([fullGroup] as never);

      await RoomUnitGroupController.list(
        { ...req, query: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        roomId: undefined,
        isActive: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ resourceType: "Location", id: "group_1" }),
      ]);
    });

    it("passes string filters and isActive=true through", async () => {
      mockedService.list.mockResolvedValue([] as never);

      await RoomUnitGroupController.list(
        {
          ...req,
          query: { roomId: "room_1", isActive: "true" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        roomId: "room_1",
        isActive: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("treats a non-true isActive string as false", async () => {
      mockedService.list.mockResolvedValue([] as never);

      await RoomUnitGroupController.list(
        {
          ...req,
          query: { isActive: "false" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it("ignores non-string query values", async () => {
      mockedService.list.mockResolvedValue([] as never);

      await RoomUnitGroupController.list(
        {
          ...req,
          query: { roomId: ["room_1"], isActive: ["true"] },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        roomId: undefined,
        isActive: undefined,
      });
    });

    it("returns 400 when no organisation id is present", async () => {
      await RoomUnitGroupController.list(
        { ...req, query: {}, organisationId: undefined } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.list).not.toHaveBeenCalled();
    });

    it("maps an unexpected error to 500 and logs it", async () => {
      mockedService.list.mockRejectedValue(new Error("db down") as never);

      await RoomUnitGroupController.list(
        { ...req, query: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to list room unit groups.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes a room unit group and returns the FHIR resource", async () => {
      mockedService.delete.mockResolvedValue(fullGroup as never);

      await RoomUnitGroupController.delete(
        { params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(mockedService.delete).toHaveBeenCalledWith("group_1", "org_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: "Location", id: "group_1" }),
      );
    });

    it("returns 400 when the group id param is missing", async () => {
      await RoomUnitGroupController.delete(
        { params: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Group identifier is required.",
      });
      expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id is present", async () => {
      await RoomUnitGroupController.delete(
        { params: { id: "group_1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitGroupServiceError to its status code", async () => {
      mockedService.delete.mockRejectedValue(
        new RoomUnitGroupServiceError(
          "Group organisation mismatch.",
          409,
        ) as never,
      );

      await RoomUnitGroupController.delete(
        { params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Group organisation mismatch.",
      });
    });

    it("maps an unexpected error to 500 and logs it", async () => {
      mockedService.delete.mockRejectedValue(new Error("explode") as never);

      await RoomUnitGroupController.delete(
        { params: { id: "group_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to delete room unit group.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });
});
