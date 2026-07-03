import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { OrganisationRoomController } from "../../../src/controllers/web/organisation-room.controller";
import { OrganisationRoomService } from "../../../src/services/organisation-room.service";

jest.mock("../../../src/services/organisation-room.service", () => ({
  OrganisationRoomService: {
    create: jest.fn(),
    update: jest.fn(),
    getAllByOrganizationId: jest.fn(),
    getSummaryByOrganizationId: jest.fn(),
    getById: jest.fn(),
    toggleAvailability: jest.fn(),
    delete: jest.fn(),
  },
  OrganisationRoomServiceError: class OrganisationRoomServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "OrganisationRoomServiceError";
    }
  },
}));

const mockedService = jest.mocked(OrganisationRoomService);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("OrganisationRoomController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  it("creates a room", async () => {
    req.body = {
      resourceType: "Location",
      name: "Inpatient Ward A",
      managingOrganization: { reference: "Organization/org_1" },
      type: {
        coding: [
          {
            system: "http://example.org/fhir/CodeSystem/organisation-room-type",
            code: "inpatient",
          },
        ],
      },
      extension: [],
    };
    mockedService.create.mockResolvedValue({
      id: "room_1",
      organisationId: "org_1",
      name: "Inpatient Ward A",
      code: "inpatient-ward-a",
      type: "INPATIENT",
      assignedSpecialiteis: [],
      assignedStaffs: [],
      availableNow: true,
      availabilityMode: "ALL_DAY",
      availabilityDays: [],
      capabilities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await OrganisationRoomController.create(req as any, res as any);

    expect(mockedService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        name: "Inpatient Ward A",
        code: "",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns a room detail", async () => {
    req.params = { organizationId: "org_1", id: "room_1" };
    mockedService.getById.mockResolvedValue({ id: "room_1" } as never);

    await OrganisationRoomController.getById(req as any, res as any);

    expect(mockedService.getById).toHaveBeenCalledWith("room_1", "org_1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("toggles room availability", async () => {
    req.params = { organizationId: "org_1", id: "room_1" };
    mockedService.toggleAvailability.mockResolvedValue({
      id: "room_1",
      availableNow: false,
    } as never);

    await OrganisationRoomController.toggleAvailability(req as any, res as any);

    expect(mockedService.toggleAvailability).toHaveBeenCalledWith(
      "room_1",
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns summary rows for an organisation", async () => {
    req.params = { organizationId: "org_1" };
    mockedService.getSummaryByOrganizationId.mockResolvedValue([
      { id: "room_1" },
    ] as never);

    await OrganisationRoomController.getAllByOrganizationId(
      req as any,
      res as any,
    );

    expect(mockedService.getSummaryByOrganizationId).toHaveBeenCalledWith(
      "org_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("passes vacantOnly through to the summary service", async () => {
    req.params = { organizationId: "org_1" };
    req.query = { vacantOnly: "true" };
    mockedService.getSummaryByOrganizationId.mockResolvedValue([
      { id: "room_1" },
    ] as never);

    await OrganisationRoomController.getAllByOrganizationId(
      req as any,
      res as any,
    );

    expect(mockedService.getSummaryByOrganizationId).toHaveBeenCalledWith(
      "org_1",
      { vacantOnly: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a missing organisation identifier", async () => {
    req.params = {};

    await OrganisationRoomController.getById(req as any, res as any);

    expect(mockedService.getById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
