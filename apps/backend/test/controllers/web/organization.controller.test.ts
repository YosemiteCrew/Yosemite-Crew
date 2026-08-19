import type { Request, Response } from "express";
import { OrganizationController } from "../../../src/controllers/web/organization.controller";
import {
  OrganizationService,
  OrganizationServiceError,
} from "../../../src/services/organization.service";
import { generatePresignedUrl } from "../../../src/middlewares/upload";
import { getParentAddressForAuthUser } from "../../../src/utils/location";
import helpers from "../../../src/utils/helper";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/organization.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/organization.service",
  );
  return {
    ...actual,
    OrganizationService: {
      resolveOrganisation: jest.fn(),
      upsert: jest.fn(),
      getById: jest.fn(),
      listAll: jest.fn(),
      deleteById: jest.fn(),
      update: jest.fn(),
      listNearbyForAppointmentsPaginated: jest.fn(),
    },
  };
});

jest.mock("../../../src/middlewares/upload", () => ({
  generatePresignedUrl: jest.fn(),
  getURLForKey: jest.fn((key: string) => `https://cdn.example/${key}`),
  buildS3Key: jest.fn(),
  moveFile: jest.fn(),
}));

jest.mock("../../../src/utils/location", () => ({
  getParentAddressForAuthUser: jest.fn(),
}));

jest.mock("../../../src/utils/helper", () => ({
  __esModule: true,
  default: { getGeoLocation: jest.fn() },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedResolveOrganisation =
  OrganizationService.resolveOrganisation as jest.Mock;
const mockedUpsert = OrganizationService.upsert as jest.Mock;
const mockedGetById = OrganizationService.getById as jest.Mock;
const mockedListAll = OrganizationService.listAll as jest.Mock;
const mockedDeleteById = OrganizationService.deleteById as jest.Mock;
const mockedUpdate = OrganizationService.update as jest.Mock;
const mockedListNearby =
  OrganizationService.listNearbyForAppointmentsPaginated as jest.Mock;
const mockedGeneratePresignedUrl = generatePresignedUrl as jest.Mock;
const mockedGetParentAddress = getParentAddressForAuthUser as jest.Mock;
const mockedGetGeoLocation = helpers.getGeoLocation as jest.Mock;
const mockedLogger = logger as unknown as { error: jest.Mock };

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  return res as Response;
};

const organizationPayload = {
  resourceType: "Organization",
  name: "Yosemite Vets",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OrganizationController.checkIsPMSOrganistaion", () => {
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
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to search business.",
    });
  });

  it("maps an OrganizationServiceError to its own status code", async () => {
    mockedResolveOrganisation.mockRejectedValueOnce(
      new OrganizationServiceError("Organisation is not searchable.", 409),
    );
    const req = { body: { placeId: "place-1" } } as Request;
    const res = createResponse();

    await OrganizationController.checkIsPMSOrganistaion(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Organisation is not searchable.",
    });
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });
});

describe("OrganizationController.onboardBusiness", () => {
  it.each([
    ["a null body", null],
    ["a primitive body", "Organization"],
    ["a non-Organization resource", { resourceType: "Patient" }],
  ])("rejects %s with 400", async (_label, body) => {
    const req = { body } as Request;
    const res = createResponse();

    await OrganizationController.onboardBusiness(req, res);

    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid payload. Expected FHIR Organization resource.",
    });
  });

  it("returns 201 with the created organisation for a new business", async () => {
    mockedUpsert.mockResolvedValueOnce({
      response: { id: "org-1" },
      created: true,
    });
    const req = {
      body: organizationPayload,
      userId: "user-1",
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.onboardBusiness(req, res);

    expect(mockedUpsert).toHaveBeenCalledWith(organizationPayload, "user-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "org-1" });
  });

  it("returns 200 when the organisation already existed", async () => {
    mockedUpsert.mockResolvedValueOnce({
      response: { id: "org-1" },
      created: false,
    });
    const req = {
      body: organizationPayload,
      headers: { "x-user-id": "header-user" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.onboardBusiness(req, res);

    expect(mockedUpsert).toHaveBeenCalledWith(
      organizationPayload,
      "header-user",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps an OrganizationServiceError to its status code", async () => {
    mockedUpsert.mockRejectedValueOnce(
      new OrganizationServiceError("Tax id already registered.", 409),
    );
    const req = {
      body: organizationPayload,
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.onboardBusiness(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Tax id already registered.",
    });
  });

  it("logs and returns 500 for unexpected failures", async () => {
    mockedUpsert.mockRejectedValueOnce(new Error("db down"));
    const req = {
      body: organizationPayload,
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.onboardBusiness(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to onboard business",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to onboard business.",
    });
  });
});

describe("OrganizationController.getBusinessById", () => {
  it("returns 400 when the business id is missing from the route", async () => {
    const req = { params: {} } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getBusinessById(req, res);

    expect(mockedGetById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Business ID is required.",
    });
  });

  it("returns 404 when no organisation matches the id", async () => {
    mockedGetById.mockResolvedValueOnce(null);
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getBusinessById(req, res);

    expect(mockedGetById).toHaveBeenCalledWith("org-1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Business not found." });
  });

  it("returns the organisation resource", async () => {
    mockedGetById.mockResolvedValueOnce({ id: "org-1" });
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getBusinessById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: "org-1" });
  });

  it("logs and returns 500 for unexpected failures", async () => {
    mockedGetById.mockRejectedValueOnce(new Error("boom"));
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getBusinessById(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to retrieve business",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to retrieve business.",
    });
  });
});

describe("OrganizationController.getAllBusinesses", () => {
  it("returns every organisation resource", async () => {
    mockedListAll.mockResolvedValueOnce([{ id: "org-1" }, { id: "org-2" }]);
    const res = createResponse();

    await OrganizationController.getAllBusinesses({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "org-1" }, { id: "org-2" }]);
  });

  it("logs and returns 500 when the listing fails", async () => {
    mockedListAll.mockRejectedValueOnce(new Error("boom"));
    const res = createResponse();

    await OrganizationController.getAllBusinesses({} as Request, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to retrieve businesses",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to retrieve businesses.",
    });
  });
});

describe("OrganizationController.deleteBusinessById", () => {
  it("returns 400 when the business id is missing", async () => {
    const req = { params: {} } as unknown as Request;
    const res = createResponse();

    await OrganizationController.deleteBusinessById(req, res);

    expect(mockedDeleteById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when nothing was deleted", async () => {
    mockedDeleteById.mockResolvedValueOnce(false);
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.deleteBusinessById(req, res);

    expect(mockedDeleteById).toHaveBeenCalledWith("org-1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Business not found." });
  });

  it("confirms the deletion", async () => {
    mockedDeleteById.mockResolvedValueOnce(true);
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.deleteBusinessById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Business deleted successfully.",
    });
  });

  it("maps an OrganizationServiceError to its status code", async () => {
    mockedDeleteById.mockRejectedValueOnce(
      new OrganizationServiceError("Organisation still has staff.", 409),
    );
    const req = { params: { organizationId: "org-1" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.deleteBusinessById(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Organisation still has staff.",
    });
  });
});

describe("OrganizationController.updateBusinessById", () => {
  it("returns 400 when the business id is missing", async () => {
    const req = { params: {}, body: organizationPayload } as unknown as Request;
    const res = createResponse();

    await OrganizationController.updateBusinessById(req, res);

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Business ID is required.",
    });
  });

  it("rejects a payload that is not a FHIR Organization", async () => {
    const req = {
      params: { organizationId: "org-1" },
      body: { resourceType: "Practitioner" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.updateBusinessById(req, res);

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid payload. Expected FHIR Organization resource.",
    });
  });

  it("returns 404 when the organisation does not exist", async () => {
    mockedUpdate.mockResolvedValueOnce(null);
    const req = {
      params: { organizationId: "org-1" },
      body: organizationPayload,
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.updateBusinessById(req, res);

    expect(mockedUpdate).toHaveBeenCalledWith("org-1", organizationPayload);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the updated organisation", async () => {
    mockedUpdate.mockResolvedValueOnce({ id: "org-1", name: "Renamed" });
    const req = {
      params: { organizationId: "org-1" },
      body: organizationPayload,
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.updateBusinessById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: "org-1", name: "Renamed" });
  });

  it("logs and returns 500 for unexpected failures", async () => {
    mockedUpdate.mockRejectedValueOnce(new Error("boom"));
    const req = {
      params: { organizationId: "org-1" },
      body: organizationPayload,
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.updateBusinessById(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to update business",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to update business.",
    });
  });
});

describe("OrganizationController.getLogoUploadUrl", () => {
  it.each([
    ["the body is not an object", undefined],
    ["the body carries no mimeType", {}],
    ["the mimeType is not a string", { mimeType: 42 }],
    ["the mimeType is empty", { mimeType: "" }],
  ])("returns 400 when %s", async (_label, body) => {
    const req = {
      body,
      params: { organizationId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getLogoUploadUrl(req, res);

    expect(mockedGeneratePresignedUrl).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "MIME type is required in the request body.",
    });
  });

  it("presigns an org-scoped upload from the route params", async () => {
    mockedGeneratePresignedUrl.mockResolvedValueOnce({
      url: "https://s3.example/put",
      key: "org/org-1/logo.png",
    });
    const req = {
      body: { mimeType: "image/png" },
      params: { organizationId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getLogoUploadUrl(req, res);

    expect(mockedGeneratePresignedUrl).toHaveBeenCalledWith(
      "image/png",
      "org",
      "organizationId=org-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      uploadUrl: "https://s3.example/put",
      s3Key: "org/org-1/logo.png",
    });
  });

  it("falls back to a temp upload when the request carries no params", async () => {
    mockedGeneratePresignedUrl.mockResolvedValueOnce({
      url: "https://s3.example/tmp",
      key: "temp/logo.png",
    });
    const req = { body: { mimeType: "image/png" } } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getLogoUploadUrl(req, res);

    expect(mockedGeneratePresignedUrl).toHaveBeenCalledWith(
      "image/png",
      "temp",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      uploadUrl: "https://s3.example/tmp",
      s3Key: "temp/logo.png",
    });
  });

  it("logs and returns 500 when presigning fails", async () => {
    mockedGeneratePresignedUrl.mockRejectedValueOnce(new Error("s3 down"));
    const req = {
      body: { mimeType: "image/png" },
      params: { organizationId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getLogoUploadUrl(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to generate logo upload URL",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to generate logo upload URL.",
    });
  });
});

describe("OrganizationController.getNearbyPaginated", () => {
  it("uses the requested coordinates and pagination without touching the saved address", async () => {
    mockedListNearby.mockResolvedValueOnce({ items: [], total: 0 });
    const req = {
      query: {
        lat: "48.85",
        lng: "2.35",
        radius: "1200",
        page: "3",
        limit: "25",
      },
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedListNearby).toHaveBeenCalledWith(48.85, 2.35, 1200, 3, 25);
    expect(mockedGetParentAddress).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0 });
  });

  it("applies the default radius, page and limit", async () => {
    mockedListNearby.mockResolvedValueOnce({ items: [] });
    const req = {
      query: { lat: "10", lng: "20" },
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedListNearby).toHaveBeenCalledWith(10, 20, 5000, 1, 10);
  });

  it("geocodes the saved parent address when coordinates are absent", async () => {
    mockedGetParentAddress.mockResolvedValueOnce({
      city: "Paris",
      postalCode: "75001",
    });
    mockedGetGeoLocation.mockResolvedValueOnce({ lat: 48.85, lng: 2.35 });
    mockedListNearby.mockResolvedValueOnce({ items: [{ id: "org-1" }] });
    const req = {
      query: {},
      userId: "user-1",
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedGetParentAddress).toHaveBeenCalledWith("user-1");
    expect(mockedGetGeoLocation).toHaveBeenCalledWith("Paris 75001");
    expect(mockedListNearby).toHaveBeenCalledWith(48.85, 2.35, 5000, 1, 10);
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: "org-1" }] });
  });

  it("falls back to the saved address when the coordinates are not numeric", async () => {
    mockedGetParentAddress.mockResolvedValueOnce({
      city: "Paris",
      postalCode: "75001",
    });
    mockedGetGeoLocation.mockResolvedValueOnce({ lat: 48.85, lng: 2.35 });
    mockedListNearby.mockResolvedValueOnce({ items: [] });
    const req = {
      query: { lat: "north", lng: "west" },
      userId: "user-1",
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedGetParentAddress).toHaveBeenCalledWith("user-1");
    expect(mockedListNearby).toHaveBeenCalledWith(48.85, 2.35, 5000, 1, 10);
  });

  it("returns 400 when the caller is anonymous and sent no coordinates", async () => {
    const req = { query: {}, headers: {} } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedGetParentAddress).not.toHaveBeenCalled();
    expect(mockedListNearby).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Location missing and user has no saved city/pincode.",
    });
  });

  it.each([
    ["no saved address", null],
    ["a saved address without a city", { city: null, postalCode: "75001" }],
    ["a saved address without a postal code", { city: "Paris" }],
  ])("returns 400 for %s", async (_label, address) => {
    mockedGetParentAddress.mockResolvedValueOnce(address);
    const req = {
      query: {},
      userId: "user-1",
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedGetGeoLocation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Location missing and user has no saved city/pincode.",
    });
  });

  it.each([
    ["the geocoder returns nothing", null],
    ["the geocoder returns non-numeric coordinates", { lat: "48.85", lng: 2 }],
  ])("returns 400 when %s", async (_label, geo) => {
    mockedGetParentAddress.mockResolvedValueOnce({
      city: "Paris",
      postalCode: "75001",
    });
    mockedGetGeoLocation.mockResolvedValueOnce(geo);
    const req = {
      query: {},
      userId: "user-1",
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedListNearby).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to resolve location from user's saved address.",
    });
  });

  it("surfaces the failure message when the lookup throws an Error", async () => {
    mockedListNearby.mockRejectedValueOnce(new Error("geo index missing"));
    const req = {
      query: { lat: "10", lng: "20" },
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Error while fetching nearby organisations: ",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "geo index missing" });
  });

  it("falls back to a generic message when a non-Error is thrown", async () => {
    mockedListNearby.mockRejectedValueOnce("kaboom");
    const req = {
      query: { lat: "10", lng: "20" },
      headers: {},
    } as unknown as Request;
    const res = createResponse();

    await OrganizationController.getNearbyPaginated(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
  });
});
