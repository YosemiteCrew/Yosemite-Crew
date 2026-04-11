import { Request, Response } from "express";
import { ServiceController } from "../../src/controllers/web/service.controller";
import {
  ServiceService,
  ServiceServiceError,
} from "../../src/services/service.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { ParentModel } from "../../src/models/parent";
import helpers from "../../src/utils/helper";
import logger from "../../src/utils/logger";

// --- Mocks ---
jest.mock("../../src/services/service.service", () => {
  const original = jest.requireActual("../../src/services/service.service");
  return {
    ...original,
    ServiceService: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      listBySpeciality: jest.fn(),
      listByOrganisation: jest.fn(),
      listOrganisationsProvidingService: jest.fn(),
      listOrganisationsProvidingServiceNearby: jest.fn(),
      getBookableSlotsService: jest.fn(),
      search: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service");
jest.mock("../../src/models/parent");
jest.mock("../../src/utils/helper", () => ({
  __esModule: true,
  default: {
    getGeoLocation: jest.fn(),
  },
}));
jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
}));

const mockRequest = (overrides: Record<string, any> = {}): Request =>
  ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  }) as unknown as Request;

const mockResponse = (): Response => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("ServiceController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  describe("Error Handler & User Resolver logic", () => {
    it("handles ServiceServiceError properly", async () => {
      req = mockRequest({ body: { name: "Test Service" } });
      const customError = new ServiceServiceError("Custom Error", 409);
      (ServiceService.create as jest.Mock).mockRejectedValueOnce(customError);

      await ServiceController.createService(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: "Custom Error" });
    });

    it("resolves userId from headers", async () => {
      req = mockRequest({
        query: { serviceName: "Vet" },
        headers: { "x-user-id": "header-user" },
      });
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      await ServiceController.listOrganisationByServiceName(req, res);
      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "header-user",
      );
    });

    it("resolves userId from auth object if headers are missing", async () => {
      req = mockRequest({
        query: { serviceName: "Vet" },
        userId: "auth-user", // simulated AuthenticatedRequest
      });
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      await ServiceController.listOrganisationByServiceName(req, res);
      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "auth-user",
      );
    });
  });

  describe("createService", () => {
    it("returns 201 on success", async () => {
      req = mockRequest({ body: { name: "Test Service" } });
      (ServiceService.create as jest.Mock).mockResolvedValueOnce({ id: "1" });

      await ServiceController.createService(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "1" });
    });

    it("returns 500 on generic error", async () => {
      req = mockRequest();
      (ServiceService.create as jest.Mock).mockRejectedValueOnce(
        new Error("Fail"),
      );
      await ServiceController.createService(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("updateService", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { id: "123" }, body: { cost: 100 } });
      (ServiceService.update as jest.Mock).mockResolvedValueOnce({ id: "123" });

      await ServiceController.updateService(req, res);

      expect(ServiceService.update).toHaveBeenCalledWith("123", { cost: 100 });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 500 on error", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.update as jest.Mock).mockRejectedValueOnce(
        new Error("Fail"),
      );
      await ServiceController.updateService(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteService", () => {
    it("returns 204 on success", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.delete as jest.Mock).mockResolvedValueOnce(true);

      await ServiceController.deleteService(req, res);

      expect(ServiceService.delete).toHaveBeenCalledWith("123");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns 500 on error", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.delete as jest.Mock).mockRejectedValueOnce(
        new Error("Fail"),
      );
      await ServiceController.deleteService(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getServiceById", () => {
    it("returns 200 when found", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.getById as jest.Mock).mockResolvedValueOnce({
        id: "123",
      });

      await ServiceController.getServiceById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "123" });
    });

    it("returns 404 when not found", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.getById as jest.Mock).mockResolvedValueOnce(null);

      await ServiceController.getServiceById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Service not found." });
    });

    it("returns 500 on error", async () => {
      req = mockRequest({ params: { id: "123" } });
      (ServiceService.getById as jest.Mock).mockRejectedValueOnce(
        new Error("Fail"),
      );
      await ServiceController.getServiceById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listServicesBySpeciality", () => {
    it("returns 200 on success", async () => {
      req = mockRequest({ params: { specialityId: "s1" } });
      (ServiceService.listBySpeciality as jest.Mock).mockResolvedValueOnce([
        "s1",
        "s2",
      ]);

      await ServiceController.listServicesBySpeciality(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(["s1", "s2"]);
    });

    it("returns 500 on error", async () => {
      req = mockRequest({ params: { specialityId: "s1" } });
      (ServiceService.listBySpeciality as jest.Mock).mockRejectedValueOnce(
        new Error("Fail"),
      );
      await ServiceController.listServicesBySpeciality(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("listOrganisationByServiceName", () => {
    it("returns 400 if serviceName is missing", async () => {
      req = mockRequest({ query: {} });
      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 if provided lat/lng are invalid numbers", async () => {
      req = mockRequest({
        query: { serviceName: "Vet", lat: "abc", lng: "def" },
      });
      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "lat and lng must be valid numbers",
      });
    });

    it("returns 200 if valid lat/lng are provided in query", async () => {
      req = mockRequest({
        query: { serviceName: "Vet", lat: "40.7", lng: "-74.1" },
      }); // Changed to non-zero fractions
      (
        ServiceService.listOrganisationsProvidingServiceNearby as jest.Mock
      ).mockResolvedValueOnce(["org1"]);

      await ServiceController.listOrganisationByServiceName(req, res);

      expect(
        ServiceService.listOrganisationsProvidingServiceNearby,
      ).toHaveBeenCalledWith("Vet", 40.7, -74.1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(["org1"]);
    });

    it("returns 400 if lat/lng omitted and user not authenticated", async () => {
      req = mockRequest({ query: { serviceName: "Vet" } }); // No headers, no auth user
      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        "Povide Latitude and Longitude if no authenticated request.",
      );
    });

    it("returns 400 if parent address is missing/incomplete", async () => {
      req = mockRequest({ query: { serviceName: "Vet" }, userId: "auth-1" });
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValueOnce({ parentId: "p1" });
      (ParentModel.findById as jest.Mock).mockResolvedValueOnce({
        address: { city: "NY" },
      }); // Missing postalCode

      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Location not provided and user has no saved city/pincode.",
      });
    });

    it("returns 400 if geolocation from parent address fails", async () => {
      req = mockRequest({ query: { serviceName: "Vet" }, userId: "auth-1" });
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValueOnce({ parentId: "p1" });
      (ParentModel.findById as jest.Mock).mockResolvedValueOnce({
        address: { city: "NY", postalCode: "10001" },
      });
      (helpers.getGeoLocation as jest.Mock).mockResolvedValueOnce({
        lat: null,
        lng: null,
      });

      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to resolve location from city and postal code.",
      });
    });

    it("returns 200 when geolocating successfully from parent address", async () => {
      req = mockRequest({ query: { serviceName: "Vet" }, userId: "auth-1" });
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValueOnce({ parentId: "p1" });
      (ParentModel.findById as jest.Mock).mockResolvedValueOnce({
        address: { city: "NY", postalCode: "10001" },
      });
      (helpers.getGeoLocation as jest.Mock).mockResolvedValueOnce({
        lat: 40.7,
        lng: -74.1,
      }); // Changed to non-zero fractions
      (
        ServiceService.listOrganisationsProvidingServiceNearby as jest.Mock
      ).mockResolvedValueOnce(["org2"]);

      await ServiceController.listOrganisationByServiceName(req, res);

      expect(helpers.getGeoLocation).toHaveBeenCalledWith("NY 10001");
      expect(
        ServiceService.listOrganisationsProvidingServiceNearby,
      ).toHaveBeenCalledWith("Vet", 40.7, -74.1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(["org2"]);
    });

    it("returns 500 on unexpected errors", async () => {
      // Provide valid lat/lng to bypass the auth checks so it actually hits the service call
      req = mockRequest({
        query: { serviceName: "Vet", lat: "40.5", lng: "-73.5" },
      });
      (
        ServiceService.listOrganisationsProvidingServiceNearby as jest.Mock
      ).mockRejectedValueOnce(new Error("Fail"));

      await ServiceController.listOrganisationByServiceName(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getBookableSlotsForService", () => {
    it("returns 400 if payload is missing fields", async () => {
      req = mockRequest({ body: { serviceId: "1" } }); // missing orgId and date
      await ServiceController.getBookableSlotsForService(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "serviceId, organisationId and date are required",
        }),
      );
    });

    it("returns 400 if date format is invalid", async () => {
      req = mockRequest({
        body: { serviceId: "1", organisationId: "2", date: "invalid-date" },
      });
      await ServiceController.getBookableSlotsForService(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid date format (use YYYY-MM-DD)",
        }),
      );
    });

    it("returns 200 on success", async () => {
      req = mockRequest({
        body: { serviceId: "1", organisationId: "2", date: "2026-01-01" },
      });
      (
        ServiceService.getBookableSlotsService as jest.Mock
      ).mockResolvedValueOnce({ slots: [] });

      await ServiceController.getBookableSlotsForService(req, res);
      expect(ServiceService.getBookableSlotsService).toHaveBeenCalledWith(
        "1",
        "2",
        expect.any(Date),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { slots: [] },
      });
    });

    it("returns 500 on error", async () => {
      req = mockRequest({
        body: { serviceId: "1", organisationId: "2", date: "2026-01-01" },
      });
      (
        ServiceService.getBookableSlotsService as jest.Mock
      ).mockRejectedValueOnce(new Error("Fail"));

      await ServiceController.getBookableSlotsForService(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
