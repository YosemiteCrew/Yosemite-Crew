import type { Request, Response } from "express";
import { OrganizationController } from "../../../src/controllers/web/organization.controller";
import { OrganizationService } from "../../../src/services/organization.service";

jest.mock("../../../src/services/organization.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/organization.service",
  );
  return {
    ...actual,
    OrganizationService: {
      resolveOrganisation: jest.fn(),
    },
  };
});

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedResolveOrganisation =
  OrganizationService.resolveOrganisation as jest.Mock;

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  return res as Response;
};

describe("OrganizationController.checkIsPMSOrganistaion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes a valid search body through to the service", async () => {
    mockedResolveOrganisation.mockResolvedValueOnce({
      isPmsOrganisation: false,
    });
    const req = {
      body: { placeId: "place-1", lat: 10, lng: 20, name: "Clinic" },
    } as Request;
    const res = createResponse();

    await OrganizationController.checkIsPMSOrganistaion(req, res);

    expect(mockedResolveOrganisation).toHaveBeenCalledWith({
      placeId: "place-1",
      lat: 10,
      lng: 20,
      name: "Clinic",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // A structured value survives mongoSanitize and would reach the Prisma string filter as a
  // StringNullableFilter, matching an arbitrary organisation.
  it.each([
    ["placeId operator object", { placeId: { not: null } }],
    ["name operator object", { name: { contains: "" } }],
    ["placeId array", { placeId: ["a", "b"] }],
    ["non-numeric lat", { lat: "10", lng: "20" }],
  ])("rejects %s with 400", async (_label, body) => {
    const req = { body } as Request;
    const res = createResponse();

    await OrganizationController.checkIsPMSOrganistaion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedResolveOrganisation).not.toHaveBeenCalled();
  });

  it("strips unknown keys before they reach the service", async () => {
    mockedResolveOrganisation.mockResolvedValueOnce({
      isPmsOrganisation: false,
    });
    const req = {
      body: { placeId: "place-1", stripeAccountId: "acct_x" },
    } as Request;
    const res = createResponse();

    await OrganizationController.checkIsPMSOrganistaion(req, res);

    expect(mockedResolveOrganisation).toHaveBeenCalledWith({
      placeId: "place-1",
    });
  });

  it("surfaces a service error through the shared handler", async () => {
    mockedResolveOrganisation.mockRejectedValueOnce(new Error("boom"));
    const req = { body: { placeId: "place-1" } } as Request;
    const res = createResponse();

    await OrganizationController.checkIsPMSOrganistaion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
