import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { AvailabilityController } from "../../../src/controllers/web/availability.controller";
import { AvailabilityService } from "../../../src/services/availability.service";
import logger from "../../../src/utils/logger";

// 1. Mock Dependencies
jest.mock("../../../src/services/availability.service");
jest.mock("../../../src/utils/logger");

// 2. Typed Mocks
const mockedAvailabilityService = jest.mocked(AvailabilityService);
const mockedLogger = jest.mocked(logger);

describe("AvailabilityController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // Helper to simulate generic errors
  const mockGenericError = (method: keyof typeof AvailabilityService) => {
    mockedAvailabilityService[method].mockRejectedValue(new Error("Boom"));
  };

  /* ============================
     BASE AVAILABILITY TESTS
  ===============================*/

  describe("setAllBaseAvailability", () => {
    it("should 400 if params missing", async () => {
      req.params = {}; // missing orgId
      await AvailabilityController.setAllBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { availabilities: [] };
      mockedAvailabilityService.setAllBaseAvailability.mockResolvedValue(
        {} as any,
      );

      await AvailabilityController.setAllBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { availabilities: [] };
      mockGenericError("setAllBaseAvailability");

      await AvailabilityController.setAllBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getBaseAvailability", () => {
    it("should 400 if missing params", async () => {
      req.params = {};
      await AvailabilityController.getBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      mockedAvailabilityService.getBaseAvailability.mockResolvedValue([]);

      await AvailabilityController.getBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      mockGenericError("getBaseAvailability");

      await AvailabilityController.getBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteBaseAvailability", () => {
    it("should 400 if missing params", async () => {
      req.params = {};
      await AvailabilityController.deleteBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      mockedAvailabilityService.deleteBaseAvailability.mockResolvedValue(
        undefined,
      );

      await AvailabilityController.deleteBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      mockGenericError("deleteBaseAvailability");

      await AvailabilityController.deleteBaseAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  /* ============================
     WEEKLY OVERRIDES TESTS
  ===============================*/

  describe("addWeeklyAvailabilityOverride", () => {
    it("should 400 if fields missing", async () => {
      req.body = {};
      await AvailabilityController.addWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 400 if date invalid", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { weekStartDate: "invalid", overrides: {} as any };
      await AvailabilityController.addWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { weekStartDate: "2023-01-01", overrides: {} as any };
      mockedAvailabilityService.addWeeklyAvailabilityOverride.mockResolvedValue(
        undefined,
      );

      await AvailabilityController.addWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { weekStartDate: "2023-01-01", overrides: {} as any };
      mockGenericError("addWeeklyAvailabilityOverride");

      await AvailabilityController.addWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getWeeklyAvailabilityOverride", () => {
    it("should 400 if missing params", async () => {
      req.query = {};
      await AvailabilityController.getWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 404 if not found", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { weekStartDate: "2023-01-01" };
      mockedAvailabilityService.getWeeklyAvailabilityOverride.mockResolvedValue(
        null,
      );

      await AvailabilityController.getWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { weekStartDate: "2023-01-01" };
      mockedAvailabilityService.getWeeklyAvailabilityOverride.mockResolvedValue(
        {} as any,
      );

      await AvailabilityController.getWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { weekStartDate: "2023-01-01" };
      mockGenericError("getWeeklyAvailabilityOverride");

      await AvailabilityController.getWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteWeeklyAvailabilityOverride", () => {
    it("should 400 if params missing", async () => {
      req.query = {};
      await AvailabilityController.deleteWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { weekStartDate: "2023-01-01" };
      mockedAvailabilityService.deleteWeeklyAvailabilityOverride.mockResolvedValue(
        undefined,
      );

      await AvailabilityController.deleteWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { weekStartDate: "2023-01-01" };
      mockGenericError("deleteWeeklyAvailabilityOverride");

      await AvailabilityController.deleteWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  /* ============================
     OCCUPANCY TESTS
  ===============================*/

  describe("addOccupancy", () => {
    it("should 400 if invalid payload", async () => {
      req.body = {};
      await AvailabilityController.addOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (201)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = {
        startTime: "2023-01-01",
        endTime: "2023-01-02",
        sourceType: "BLOCK",
      };
      mockedAvailabilityService.addOccupancy.mockResolvedValue(undefined);

      await AvailabilityController.addOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = {
        startTime: "2023-01-01",
        endTime: "2023-01-02",
        sourceType: "BLOCK",
      };
      mockGenericError("addOccupancy");

      await AvailabilityController.addOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("addAllOccupancies", () => {
    it("should 400 if fields missing", async () => {
      req.body = {};
      await AvailabilityController.addAllOccupancies(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 400 if invalid occupancy item", async () => {
      req.body = { organisationId: "o1", userId: "u1", occupancies: [{}] }; // missing dates
      await AvailabilityController.addAllOccupancies(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (201)", async () => {
      req.body = {
        organisationId: "o1",
        userId: "u1",
        occupancies: [
          {
            startTime: "2023-01-01",
            endTime: "2023-01-02",
            sourceType: "BLOCK",
          },
        ],
      };
      mockedAvailabilityService.addAllOccupancies.mockResolvedValue(undefined);

      await AvailabilityController.addAllOccupancies(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle error", async () => {
      req.body = {
        organisationId: "o1",
        userId: "u1",
        occupancies: [
          {
            startTime: "2023-01-01",
            endTime: "2023-01-02",
            sourceType: "BLOCK",
          },
        ],
      };
      mockGenericError("addAllOccupancies");

      await AvailabilityController.addAllOccupancies(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getOccupancy", () => {
    it("should 400 if missing filters", async () => {
      req.query = {};
      await AvailabilityController.getOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { startDate: "2023-01-01", endDate: "2023-01-31" };
      mockedAvailabilityService.getOccupancy.mockResolvedValue([]);

      await AvailabilityController.getOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { startDate: "2023-01-01", endDate: "2023-01-31" };
      mockGenericError("getOccupancy");

      await AvailabilityController.getOccupancy(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  /* ============================
     FINAL AVAILABILITY & STATUS
  ===============================*/

  describe("getFinalAvailability", () => {
    it("should 400 if params missing", async () => {
      req.query = {};
      await AvailabilityController.getFinalAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { referenceDate: "2023-01-01" };
      mockedAvailabilityService.getFinalAvailabilityForDate.mockResolvedValue(
        {} as any,
      );

      await AvailabilityController.getFinalAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.query = { referenceDate: "2023-01-01" };
      mockGenericError("getFinalAvailabilityForDate");

      await AvailabilityController.getFinalAvailability(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getCurrentStatus", () => {
    it("should 400 if params missing", async () => {
      req.params = {};
      await AvailabilityController.getCurrentStatus(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should success (200)", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      // FIX: Cast string 'AVAILABLE' to any to bypass strict literal type check in test
      mockedAvailabilityService.getCurrentStatus.mockResolvedValue(
        "AVAILABLE" as any,
      );

      await AvailabilityController.getCurrentStatus(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ status: "AVAILABLE" });
    });

    it("should handle error", async () => {
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      mockGenericError("getCurrentStatus");

      await AvailabilityController.getCurrentStatus(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("Helpers (Coverage)", () => {
    it("should resolve userId from header", async () => {
      req.headers = { "x-user-id": "headerUser" };
      req.params = { orgId: "o1" };
      mockedAvailabilityService.getCurrentStatus.mockResolvedValue(
        "AVAILABLE" as any,
      );

      await AvailabilityController.getCurrentStatus(
        req as any,
        res as Response,
      );
      expect(mockedAvailabilityService.getCurrentStatus).toHaveBeenCalledWith(
        "o1",
        "headerUser",
      );
    });

    it("safeDate should return undefined for invalid values", async () => {
      // Indirectly testing via addWeeklyAvailabilityOverride with invalid date
      (req as any).userId = "u1";
      req.params = { orgId: "o1" };
      req.body = { weekStartDate: null, overrides: {} };
      await AvailabilityController.addWeeklyAvailabilityOverride(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });
});
