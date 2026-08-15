import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { ServiceController } from "../../../src/controllers/web/service.controller";
import {
  ServiceService,
  ServiceServiceError,
} from "../../../src/services/service.service";
import {
  CatalogService,
  CatalogServiceError,
} from "../../../src/services/catalog.service";
import logger from "../../../src/utils/logger";
import { resolveUserIdFromRequest } from "../../../src/utils/request";
import { getParentAddressForAuthUser } from "../../../src/utils/location";
import helpers from "../../../src/utils/helper";

jest.mock("../../../src/services/service.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/service.service")
  >("../../../src/services/service.service");
  return {
    ...actual,
    ServiceService: {
      ...actual.ServiceService,
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      listBySpeciality: jest.fn(),
      listByOrganisation: jest.fn(),
      listOrganisationsProvidingServiceNearby: jest.fn(),
    },
  };
});
jest.mock("../../../src/services/catalog.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/catalog.service")
  >("../../../src/services/catalog.service");
  return {
    ...actual,
    CatalogService: {
      ...actual.CatalogService,
      getBookableSlotsService: jest.fn(),
      getCalendarPrefillMatches: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");
jest.mock("../../../src/utils/request", () => ({
  resolveUserIdFromRequest: jest.fn(),
}));
jest.mock("../../../src/utils/location", () => ({
  getParentAddressForAuthUser: jest.fn(),
}));
jest.mock("../../../src/utils/helper", () => ({
  __esModule: true,
  default: {
    getGeoLocation: jest.fn(),
  },
}));

const mockedServiceService = jest.mocked(ServiceService);
const mockedCatalogService = jest.mocked(CatalogService);
const mockedLogger = jest.mocked(logger);
const mockedResolveUserIdFromRequest = jest.mocked(resolveUserIdFromRequest);
const mockedGetParentAddressForAuthUser = jest.mocked(
  getParentAddressForAuthUser,
);
const mockedHelpers = jest.mocked(helpers);

describe("ServiceController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { body: {}, params: {} };
    res = { status: statusMock, json: jsonMock } as unknown as Response;

    jest.clearAllMocks();
  });

  describe("createService", () => {
    it("returns 400 when payload is not a FHIR HealthcareService", async () => {
      req.body = { resourceType: "Organization" };

      await ServiceController.createService(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Invalid"),
        }),
      );
      expect(mockedServiceService.create).not.toHaveBeenCalled();
    });

    it("returns 201 with the created service", async () => {
      req.body = { resourceType: "HealthcareService", id: "svc-1" };
      mockedServiceService.create.mockResolvedValue({ id: "svc-1" } as never);

      await ServiceController.createService(req as any, res as Response);

      expect(mockedServiceService.create).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: "svc-1" });
    });
  });

  describe("createMany", () => {
    it("returns 400 when body is not an array", async () => {
      req.body = { resourceType: "HealthcareService" };

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedServiceService.createMany).not.toHaveBeenCalled();
    });

    it("returns 400 when array contains non-HealthcareService items", async () => {
      req.body = [
        { resourceType: "HealthcareService" },
        { resourceType: "Organization" },
      ];

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedServiceService.createMany).not.toHaveBeenCalled();
    });

    it("returns 201 with created services", async () => {
      req.body = [{ resourceType: "HealthcareService", id: "a" }];
      mockedServiceService.createMany.mockResolvedValue([
        { resourceType: "HealthcareService", id: "s1" } as any,
      ]);

      await ServiceController.createMany(req as any, res as Response);

      expect(mockedServiceService.createMany).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith([
        expect.objectContaining({ id: "s1" }),
      ]);
    });

    it("maps ServiceServiceError to its status code", async () => {
      req.body = [{ resourceType: "HealthcareService" }];
      mockedServiceService.createMany.mockRejectedValue(
        new ServiceServiceError("Bad request", 400),
      );

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad request" });
    });

    it("falls back to 500 on unknown errors", async () => {
      req.body = [{ resourceType: "HealthcareService" }];
      mockedServiceService.createMany.mockRejectedValue("boom");

      await ServiceController.createMany(req as any, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to create services.",
      });
    });
  });

  describe("updateService", () => {
    it("updates a service scoped to the authorized organisation", async () => {
      req.params = { id: "svc-1" };
      req.body = { resourceType: "HealthcareService" };
      (req as { organisationId?: string }).organisationId = "org-1";
      mockedServiceService.update.mockResolvedValue({ id: "svc-1" } as never);

      await ServiceController.updateService(req as any, res as Response);

      expect(mockedServiceService.update).toHaveBeenCalledWith(
        "svc-1",
        req.body,
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: "svc-1" });
    });

    it("maps update errors onto their status code", async () => {
      req.params = { id: "svc-1" };
      mockedServiceService.update.mockRejectedValue(
        new ServiceServiceError("Service not found", 404),
      );

      await ServiceController.updateService(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Service not found" });
    });
  });

  describe("deleteService", () => {
    it("deletes a service and returns 204", async () => {
      req.params = { id: "svc-1" };
      const sendMock = jest.fn();
      statusMock.mockReturnValue({ json: jsonMock, send: sendMock });
      mockedServiceService.delete.mockResolvedValue(true as never);

      await ServiceController.deleteService(req as any, res as Response);

      expect(mockedServiceService.delete).toHaveBeenCalledWith(
        "svc-1",
        undefined,
      );
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });

    it("maps delete errors onto their status code", async () => {
      req.params = { id: "svc-1" };
      mockedServiceService.delete.mockRejectedValue(
        new ServiceServiceError("Service not found", 404),
      );

      await ServiceController.deleteService(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Service not found" });
    });
  });

  describe("getServiceById", () => {
    it("returns 404 when the service does not exist", async () => {
      req.params = { id: "svc-missing" };
      mockedServiceService.getById.mockResolvedValue(null as never);

      await ServiceController.getServiceById(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Service not found.",
      });
    });

    it("returns the service when found", async () => {
      req.params = { id: "svc-1" };
      mockedServiceService.getById.mockResolvedValue({
        id: "svc-1",
      } as never);

      await ServiceController.getServiceById(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: "svc-1" });
    });
  });

  describe("listServicesBySpeciality", () => {
    it("returns services for a speciality", async () => {
      req.params = { specialityId: "spec-1" };
      mockedServiceService.listBySpeciality.mockResolvedValue([] as never);

      await ServiceController.listServicesBySpeciality(
        req as Request,
        res as Response,
      );

      expect(mockedServiceService.listBySpeciality).toHaveBeenCalledWith(
        "spec-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe("listByOrganisation", () => {
    it("returns services for an organisation", async () => {
      req.params = { organisationId: "org-1" };
      mockedServiceService.listByOrganisation.mockResolvedValue([] as never);

      await ServiceController.listByOrganisation(
        req as Request,
        res as Response,
      );

      expect(mockedServiceService.listByOrganisation).toHaveBeenCalledWith(
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it("falls back to 500 on unknown errors", async () => {
      req.params = { organisationId: "org-1" };
      mockedServiceService.listByOrganisation.mockRejectedValue("boom");

      await ServiceController.listByOrganisation(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to fetch service.",
      });
    });
  });

  describe("listOrganisationByServiceName", () => {
    it("returns 400 when serviceName is missing", async () => {
      req.query = {};

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Query parameter serviceName is required.",
      });
    });

    it("returns 400 for non-numeric coordinates", async () => {
      req.query = { serviceName: "Vaccination", lat: "abc", lng: "20" };

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "lat and lng must be valid numbers",
      });
    });

    it("returns 400 when unauthenticated and no coordinates are provided", async () => {
      req.query = { serviceName: "Vaccination" };
      mockedResolveUserIdFromRequest.mockReturnValue(undefined);

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        "Povide Latitude and Longitude if no authenticated request.",
      );
    });

    it("returns 400 when the authenticated user has no saved address", async () => {
      req.query = { serviceName: "Vaccination" };
      mockedResolveUserIdFromRequest.mockReturnValue("user-1");
      mockedGetParentAddressForAuthUser.mockResolvedValue(null as never);

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Location not provided and user has no saved city/pincode.",
      });
    });

    it("returns 400 when the saved address cannot be geocoded", async () => {
      req.query = { serviceName: "Vaccination" };
      mockedResolveUserIdFromRequest.mockReturnValue("user-1");
      mockedGetParentAddressForAuthUser.mockResolvedValue({
        city: "Pune",
        postalCode: "411001",
      } as never);
      mockedHelpers.getGeoLocation.mockResolvedValue({} as never);

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to resolve location from city and postal code.",
      });
    });

    it("returns 200 with nearby organisations for valid coordinates", async () => {
      req.query = {
        serviceName: "Vaccination",
        lat: "10",
        lng: "20",
        query: "pune",
      };
      mockedServiceService.listOrganisationsProvidingServiceNearby.mockResolvedValue(
        [] as never,
      );

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(
        mockedServiceService.listOrganisationsProvidingServiceNearby,
      ).toHaveBeenCalledWith("Vaccination", 10, 20, "pune");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it("resolves coordinates from the saved address for authenticated callers", async () => {
      req.query = { serviceName: "Vaccination" };
      mockedResolveUserIdFromRequest.mockReturnValue("user-1");
      mockedGetParentAddressForAuthUser.mockResolvedValue({
        city: "Pune",
        postalCode: "411001",
      } as never);
      mockedHelpers.getGeoLocation.mockResolvedValue({
        lat: 18.52,
        lng: 73.85,
      } as never);
      mockedServiceService.listOrganisationsProvidingServiceNearby.mockResolvedValue(
        [] as never,
      );

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(
        mockedServiceService.listOrganisationsProvidingServiceNearby,
      ).toHaveBeenCalledWith("Vaccination", 18.52, 73.85, "Pune 411001");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it("falls back to 500 when the nearby lookup fails", async () => {
      req.query = { serviceName: "Vaccination", lat: "10", lng: "20" };
      mockedServiceService.listOrganisationsProvidingServiceNearby.mockRejectedValue(
        "boom",
      );

      await ServiceController.listOrganisationByServiceName(
        req as Request,
        res as Response,
      );

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to fetch organisations by service.",
      });
    });
  });

  describe("getBookableSlotsForService", () => {
    it("returns 400 when required fields are missing", async () => {
      req.body = { serviceId: "svc-1" };

      await ServiceController.getBookableSlotsForService(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "serviceId, organisationId and date are required",
      });
    });

    it("returns the zod message when fields are present but invalid", async () => {
      req.body = {
        serviceId: "svc-1",
        organisationId: "org-1",
        date: "not-a-date",
      };

      await ServiceController.getBookableSlotsForService(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date format (use YYYY-MM-DD)",
      });
    });

    it("maps bookable slot errors onto their status code", async () => {
      req.body = {
        serviceId: "svc-1",
        organisationId: "org-1",
        date: "2026-04-01",
      };
      mockedCatalogService.getBookableSlotsService.mockRejectedValue(
        new CatalogServiceError("Product not found.", 404),
      );

      await ServiceController.getBookableSlotsForService(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Product not found.",
      });
    });

    it("strips vetIds from windows for unauthenticated callers", async () => {
      req.body = {
        serviceId: "svc-1",
        organisationId: "org-1",
        date: "2026-04-01",
      };
      mockedCatalogService.getBookableSlotsService.mockResolvedValue({
        date: "2026-04-01",
        dayOfWeek: "WEDNESDAY",
        windows: [{ startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] }],
      } as never);

      await ServiceController.getBookableSlotsForService(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          date: "2026-04-01",
          dayOfWeek: "WEDNESDAY",
          windows: [{ startTime: "09:00", endTime: "09:30" }],
        },
      });
    });
  });

  describe("getCalendarPrefill", () => {
    it("returns 400 for an invalid payload", async () => {
      req.body = { organisationId: "org-1" };

      await ServiceController.getCalendarPrefill(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
      expect(
        mockedCatalogService.getCalendarPrefillMatches,
      ).not.toHaveBeenCalled();
    });

    it("keeps vetIds on matches for authenticated callers", async () => {
      req.body = {
        organisationId: "org-1",
        date: "2026-04-01",
        minuteOfDay: 540,
        serviceIds: ["svc-1"],
      };
      (req as { userId?: string }).userId = "staff-1";
      mockedCatalogService.getCalendarPrefillMatches.mockResolvedValue([
        {
          serviceId: "svc-1",
          slot: { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
          meta: { localStartMinute: 540, localEndMinute: 570 },
        },
      ] as never);

      await ServiceController.getCalendarPrefill(req as any, res as Response);

      expect(
        mockedCatalogService.getCalendarPrefillMatches,
      ).toHaveBeenCalledWith({
        organisationId: "org-1",
        date: new Date("2026-04-01T00:00:00.000Z"),
        minuteOfDay: 540,
        leadId: undefined,
        serviceIds: ["svc-1"],
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          matches: [
            expect.objectContaining({
              slot: { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
            }),
          ],
        },
      });
    });

    it("strips vetIds from matches for unauthenticated callers", async () => {
      req.body = {
        organisationId: "org-1",
        date: "2026-04-01",
        minuteOfDay: 540,
        serviceIds: ["svc-1"],
      };
      mockedCatalogService.getCalendarPrefillMatches.mockResolvedValue([
        {
          serviceId: "svc-1",
          slot: { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
          meta: { localStartMinute: 540, localEndMinute: 570 },
        },
      ] as never);

      await ServiceController.getCalendarPrefill(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          matches: [
            expect.objectContaining({
              slot: { startTime: "09:00", endTime: "09:30" },
            }),
          ],
        },
      });
    });

    it("maps prefill errors onto their status code", async () => {
      req.body = {
        organisationId: "org-1",
        date: "2026-04-01",
        minuteOfDay: 540,
        serviceIds: ["svc-1"],
      };
      mockedCatalogService.getCalendarPrefillMatches.mockRejectedValue(
        new CatalogServiceError("Product not found.", 404),
      );

      await ServiceController.getCalendarPrefill(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Product not found.",
      });
    });
  });
});
