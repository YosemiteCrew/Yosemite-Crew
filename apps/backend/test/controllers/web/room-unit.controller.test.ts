import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { RoomUnitController } from "../../../src/controllers/web/room-unit.controller";
import { RoomUnitService } from "../../../src/services/room-unit.service";

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

const mockedService = jest.mocked(RoomUnitService);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("RoomUnitController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  it("creates a room unit", async () => {
    req.body = {
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
    };
    mockedService.create.mockResolvedValue({ id: "unit_1" } as never);

    await RoomUnitController.create(req as any, res as any);

    expect(mockedService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        roomId: "room_1",
        code: "KEN-01",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("lists room units", async () => {
    req = { ...req, organisationId: "org_1" } as Partial<Request>;
    req.query = {};
    mockedService.list.mockResolvedValue([
      {
        id: "unit_1",
        organisationId: "org_1",
        roomId: "room_1",
        code: "KEN-01",
        displayName: "Kennel 1",
      },
    ] as never);

    await RoomUnitController.list(req as any, res as any);

    expect(mockedService.list).toHaveBeenCalledWith({
      organisationId: "org_1",
      roomId: undefined,
      unitGroupId: undefined,
      isActive: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects invalid payloads and missing organisation ids", async () => {
    req.body = { resourceType: "Observation" };
    await RoomUnitController.create(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid payload. Expected FHIR Location resource.",
    });

    res = buildResponse();
    req.body = {
      resourceType: "Location",
      name: "Kennel 1",
      partOf: { reference: "Location/room_1" },
      extension: [],
    };
    await RoomUnitController.create(
      { ...req, organisationId: undefined } as any,
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Organization identifier is required.",
    });
  });

  it("handles missing update ids and delete organisation ids", async () => {
    req.body = {
      resourceType: "Location",
      name: "Kennel 1",
      managingOrganization: { reference: "Organization/org_1" },
      partOf: { reference: "Location/room_1" },
      extension: [],
    };

    await RoomUnitController.update({ ...req, params: {} } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unit identifier is required.",
    });

    await RoomUnitController.delete(
      { params: { id: "unit_1" } } as any,
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Organization identifier is required.",
    });
  });
});
