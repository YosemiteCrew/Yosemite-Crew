import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { RoomUnitController } from "../../../src/controllers/web/room-unit.controller";
import {
  RoomUnitService,
  RoomUnitServiceError,
} from "../../../src/services/room-unit.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/room-unit.service", () => ({
  RoomUnitService: {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  },
  RoomUnitServiceError: class RoomUnitServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "RoomUnitServiceError";
    }
  },
}));

jest.mock("../../../src/utils/logger");

const mockedService = jest.mocked(RoomUnitService);
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
  name: "Kennel 1",
  managingOrganization: { reference: "Organization/org_1" },
  partOf: { reference: "Location/room_1" },
  extension: [
    {
      url: "https://yosemitecrew.com/fhir/StructureDefinition/room-unit-code",
      valueString: "KEN-01",
    },
  ],
  ...overrides,
});

const fullUnit = {
  id: "unit_1",
  organisationId: "org_1",
  roomId: "room_1",
  code: "KEN-01",
  displayName: "Kennel 1",
  isActive: true,
};

describe("RoomUnitController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  describe("create", () => {
    it("creates a room unit and returns the FHIR resource", async () => {
      req.body = locationPayload({
        extension: [
          {
            url: "https://yosemitecrew.com/fhir/StructureDefinition/room-unit-code",
            valueString: "KEN-01",
          },
        ],
      });
      mockedService.create.mockResolvedValue(fullUnit as never);

      await RoomUnitController.create(req as any, res as any);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_1",
          roomId: "room_1",
          code: "KEN-01",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: "Location",
          id: "unit_1",
          name: "Kennel 1",
        }),
      );
    });

    it("uses the request organisation id as a fallback source", async () => {
      req.body = locationPayload({ managingOrganization: undefined });
      mockedService.create.mockResolvedValue(fullUnit as never);

      await RoomUnitController.create(
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

      await RoomUnitController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Location resource.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id can be resolved", async () => {
      req.body = locationPayload({ managingOrganization: undefined });

      await RoomUnitController.create(
        { ...req, organisationId: undefined } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitServiceError to its status code", async () => {
      req.body = locationPayload();
      mockedService.create.mockRejectedValue(
        new RoomUnitServiceError("Organisation room not found.", 404) as never,
      );

      await RoomUnitController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organisation room not found.",
      });
    });

    it("maps an unexpected error to 500 and logs it", async () => {
      req.body = locationPayload();
      mockedService.create.mockRejectedValue(new Error("boom") as never);

      await RoomUnitController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to create room unit.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates a room unit when the payload organisation matches", async () => {
      req.body = locationPayload();
      mockedService.update.mockResolvedValue(fullUnit as never);

      await RoomUnitController.update(
        {
          ...req,
          params: { id: "unit_1" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "unit_1",
        "org_1",
        expect.objectContaining({ organisationId: "org_1", roomId: "room_1" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: "Location", id: "unit_1" }),
      );
    });

    it("updates when the payload carries no organisation id", async () => {
      req.body = locationPayload({ managingOrganization: undefined });
      mockedService.update.mockResolvedValue(fullUnit as never);

      await RoomUnitController.update(
        {
          ...req,
          params: { id: "unit_1" },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "unit_1",
        "org_1",
        expect.objectContaining({ organisationId: "" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects a non-Location payload with 400", async () => {
      req.body = { resourceType: "Observation" };

      await RoomUnitController.update(
        { ...req, params: { id: "unit_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid payload. Expected FHIR Location resource.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the unit id param is missing", async () => {
      req.body = locationPayload();

      await RoomUnitController.update(
        { ...req, params: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unit identifier is required.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id is present", async () => {
      req.body = locationPayload({ managingOrganization: undefined });

      await RoomUnitController.update(
        { ...req, params: { id: "unit_1" }, organisationId: undefined } as any,
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

      await RoomUnitController.update(
        { ...req, params: { id: "unit_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Organization identifier does not match the authorized organisation.",
      });
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitServiceError to its status code", async () => {
      req.body = locationPayload();
      mockedService.update.mockRejectedValue(
        new RoomUnitServiceError("Room unit not found.", 404) as never,
      );

      await RoomUnitController.update(
        { ...req, params: { id: "unit_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Room unit not found.",
      });
    });
  });

  describe("list", () => {
    it("lists room units with no filters", async () => {
      mockedService.list.mockResolvedValue([fullUnit] as never);

      await RoomUnitController.list(
        { ...req, query: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        roomId: undefined,
        unitGroupId: undefined,
        isActive: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ resourceType: "Location", id: "unit_1" }),
      ]);
    });

    it("passes string filters and isActive=true through", async () => {
      mockedService.list.mockResolvedValue([] as never);

      await RoomUnitController.list(
        {
          ...req,
          query: {
            roomId: "room_1",
            unitGroupId: "group_1",
            isActive: "true",
          },
          organisationId: "org_1",
        } as any,
        res as any,
      );

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        roomId: "room_1",
        unitGroupId: "group_1",
        isActive: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("treats a non-true isActive string as false", async () => {
      mockedService.list.mockResolvedValue([] as never);

      await RoomUnitController.list(
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

    it("returns 400 when no organisation id is present", async () => {
      await RoomUnitController.list(
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

      await RoomUnitController.list(
        { ...req, query: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to list room units.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes a room unit and returns the FHIR resource", async () => {
      mockedService.delete.mockResolvedValue(fullUnit as never);

      await RoomUnitController.delete(
        { params: { id: "unit_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(mockedService.delete).toHaveBeenCalledWith("unit_1", "org_1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: "Location", id: "unit_1" }),
      );
    });

    it("returns 400 when the unit id param is missing", async () => {
      await RoomUnitController.delete(
        { params: {}, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unit identifier is required.",
      });
      expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it("returns 400 when no organisation id is present", async () => {
      await RoomUnitController.delete(
        { params: { id: "unit_1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization identifier is required.",
      });
      expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it("maps a RoomUnitServiceError to its status code", async () => {
      mockedService.delete.mockRejectedValue(
        new RoomUnitServiceError("Unit organisation mismatch.", 409) as never,
      );

      await RoomUnitController.delete(
        { params: { id: "unit_1" }, organisationId: "org_1" } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unit organisation mismatch.",
      });
    });
  });
});
