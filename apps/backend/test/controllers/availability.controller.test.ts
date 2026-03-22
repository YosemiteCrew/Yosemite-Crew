import { AvailabilityController } from "../../src/controllers/web/availability.controller";
import { AvailabilityService } from "../../src/services/availability.service";
import logger from "src/utils/logger";

// --- Global Mocks Setup ---
jest.mock("../../src/services/availability.service", () => ({
  __esModule: true,
  AvailabilityService: {
    setAllBaseAvailability: jest.fn(),
    getBaseAvailability: jest.fn(),
    getOrganisationBaseAvailability: jest.fn(),
    deleteBaseAvailability: jest.fn(),
    addWeeklyAvailabilityOverride: jest.fn(),
    getWeeklyAvailabilityOverride: jest.fn(),
    deleteWeeklyAvailabilityOverride: jest.fn(),
    addOccupancy: jest.fn(),
    addAllOccupancies: jest.fn(),
    getOccupancy: jest.fn(),
    getFinalAvailabilityForDate: jest.fn(),
    getCurrentStatus: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("AvailabilityController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Standard mock Express request
    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      userId: "auth_user_123", // Used by auth middleware fallback
    };

    // Standard mock Express response
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("Internal Helpers (Implicitly Tested)", () => {
    it("resolveUserIdFromRequest: should use x-user-id header if present", async () => {
      req.headers["x-user-id"] = "header_user_id";
      req.params.orgId = "org1";

      // Removed "as Request" and "as Response"
      await AvailabilityController.getBaseAvailability(req, res);

      expect(AvailabilityService.getBaseAvailability).toHaveBeenCalledWith(
        "org1",
        "header_user_id",
      );
    });

    it('handleControllerError: should fallback to "Internal server error" if err is not an Error instance', async () => {
      req.params.orgId = "org1";
      (AvailabilityService.getBaseAvailability as jest.Mock).mockRejectedValue(
        "String Error",
      );

      // Removed "as Request" and "as Response"
      await AvailabilityController.getBaseAvailability(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        "getBaseAvailability error",
        "String Error",
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("Base Availability", () => {
    describe("getOrganisationBaseAvailability", () => {
      it("should return 400 if orgId is missing", async () => {
        await AvailabilityController.getOrganisationBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Missing orgId" });
      });

      it("should return 200 with data on success", async () => {
        req.params.orgId = "org1";
        (
          AvailabilityService.getOrganisationBaseAvailability as jest.Mock
        ).mockResolvedValue(["row1"]);

        await AvailabilityController.getOrganisationBaseAvailability(req, res);

        expect(
          AvailabilityService.getOrganisationBaseAvailability,
        ).toHaveBeenCalledWith("org1");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: ["row1"] });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        const err = new Error("DB Error");
        (
          AvailabilityService.getOrganisationBaseAvailability as jest.Mock
        ).mockRejectedValue(err);

        await AvailabilityController.getOrganisationBaseAvailability(req, res);

        expect(logger.error).toHaveBeenCalledWith(
          "getOrganisationBaseAvailability error",
          err,
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "DB Error" });
      });
    });

    describe("setAllBaseAvailability", () => {
      it("should return 400 if orgId is missing", async () => {
        req.body = { availabilities: [] };
        await AvailabilityController.setAllBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Missing or invalid payload",
        });
      });

      it("should return 400 if availabilities is not an array", async () => {
        req.params.orgId = "org1";
        req.body = { availabilities: "not-an-array" };
        await AvailabilityController.setAllBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 201 and data on success", async () => {
        req.params.orgId = "org1";
        req.body = { availabilities: [{ dayOfWeek: "MONDAY", slots: [] }] };
        (
          AvailabilityService.setAllBaseAvailability as jest.Mock
        ).mockResolvedValue("mockData");

        await AvailabilityController.setAllBaseAvailability(req, res);

        expect(AvailabilityService.setAllBaseAvailability).toHaveBeenCalledWith(
          "org1",
          "auth_user_123",
          req.body.availabilities,
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          message: "Base availability saved",
          data: "mockData",
        });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.body = { availabilities: [] };
        const err = new Error("DB Error");
        (
          AvailabilityService.setAllBaseAvailability as jest.Mock
        ).mockRejectedValue(err);

        await AvailabilityController.setAllBaseAvailability(req, res);

        expect(logger.error).toHaveBeenCalledWith(
          "setAllBaseAvailability error",
          err,
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "DB Error" });
      });
    });

    describe("getBaseAvailability", () => {
      it("should return 400 if orgId is missing", async () => {
        await AvailabilityController.getBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Missing orgId or userId",
        });
      });

      it("should return 200 and data on success", async () => {
        req.params.orgId = "org1";
        (
          AvailabilityService.getBaseAvailability as jest.Mock
        ).mockResolvedValue("baseData");

        await AvailabilityController.getBaseAvailability(req, res);

        expect(AvailabilityService.getBaseAvailability).toHaveBeenCalledWith(
          "org1",
          "auth_user_123",
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: "baseData" });
      });
    });

    describe("deleteBaseAvailability", () => {
      it("should return 400 if orgId is missing", async () => {
        await AvailabilityController.deleteBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 200 on success", async () => {
        req.params.orgId = "org1";
        await AvailabilityController.deleteBaseAvailability(req, res);
        expect(AvailabilityService.deleteBaseAvailability).toHaveBeenCalledWith(
          "org1",
          "auth_user_123",
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: "Base availability deleted",
        });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        (
          AvailabilityService.deleteBaseAvailability as jest.Mock
        ).mockRejectedValue(new Error("Del Error"));
        await AvailabilityController.deleteBaseAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("Weekly Overrides", () => {
    describe("addWeeklyAvailabilityOverride", () => {
      it("should return 400 if required fields are missing", async () => {
        req.params.orgId = "org1";
        await AvailabilityController.addWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Missing fields" });
      });

      it("should return 400 if date is invalid (tests safeDate helper)", async () => {
        req.params.orgId = "org1";
        req.body = { weekStartDate: "invalid-date", overrides: {} };
        await AvailabilityController.addWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid date" });
      });

      it("should return 201 on success (tests safeDate with Date object)", async () => {
        req.params.orgId = "org1";
        const dateObj = new Date("2026-03-07T00:00:00Z");
        req.body = { weekStartDate: dateObj, overrides: { MONDAY: [] } };

        await AvailabilityController.addWeeklyAvailabilityOverride(req, res);

        expect(
          AvailabilityService.addWeeklyAvailabilityOverride,
        ).toHaveBeenCalledWith(
          "org1",
          "auth_user_123",
          dateObj,
          req.body.overrides,
        );
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.body = { weekStartDate: "2026-03-07", overrides: {} };
        (
          AvailabilityService.addWeeklyAvailabilityOverride as jest.Mock
        ).mockRejectedValue(new Error("err"));
        await AvailabilityController.addWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("getWeeklyAvailabilityOverride", () => {
      it("should return 400 if params are missing (tests safeDate with null/undefined)", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = undefined;
        await AvailabilityController.getWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 404 if no override found", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = "2026-03-07";
        (
          AvailabilityService.getWeeklyAvailabilityOverride as jest.Mock
        ).mockResolvedValue(null);

        await AvailabilityController.getWeeklyAvailabilityOverride(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "No override found" });
      });

      it("should return 200 and data if found", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = "2026-03-07";
        (
          AvailabilityService.getWeeklyAvailabilityOverride as jest.Mock
        ).mockResolvedValue("overrideData");

        await AvailabilityController.getWeeklyAvailabilityOverride(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: "overrideData" });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = "2026-03-07";
        (
          AvailabilityService.getWeeklyAvailabilityOverride as jest.Mock
        ).mockRejectedValue(new Error("err"));
        await AvailabilityController.getWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("deleteWeeklyAvailabilityOverride", () => {
      it("should return 400 if params are missing", async () => {
        await AvailabilityController.deleteWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 200 on success", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = "2026-03-07";

        await AvailabilityController.deleteWeeklyAvailabilityOverride(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Override deleted" });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.query.weekStartDate = "2026-03-07";
        (
          AvailabilityService.deleteWeeklyAvailabilityOverride as jest.Mock
        ).mockRejectedValue(new Error("err"));
        await AvailabilityController.deleteWeeklyAvailabilityOverride(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("Occupancy Blocks", () => {
    describe("addOccupancy", () => {
      it("should return 400 if payload is missing", async () => {
        req.params.orgId = "org1";
        await AvailabilityController.addOccupancy(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 201 on success", async () => {
        req.params.orgId = "org1";
        req.body = {
          startTime: "2026-03-07T10:00:00Z",
          endTime: "2026-03-07T11:00:00Z",
          sourceType: "BLOCK",
          referenceId: "ref1",
        };

        await AvailabilityController.addOccupancy(req, res);

        expect(AvailabilityService.addOccupancy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.body = {
          startTime: "2026-03-07T10:00:00Z",
          endTime: "2026-03-07T11:00:00Z",
          sourceType: "BLOCK",
        };
        (AvailabilityService.addOccupancy as jest.Mock).mockRejectedValue(
          new Error("err"),
        );
        await AvailabilityController.addOccupancy(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("addAllOccupancies", () => {
      it("should return 400 if top-level fields are missing", async () => {
        await AvailabilityController.addAllOccupancies(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Missing fields" });
      });

      it("should return 400 if inner loop encounters an invalid date", async () => {
        req.body = {
          organisationId: "org1",
          userId: "u1",
          occupancies: [
            {
              startTime: "invalid",
              endTime: "2026-03-07T11:00:00Z",
              sourceType: "BLOCK",
            },
          ],
        };
        await AvailabilityController.addAllOccupancies(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Invalid occupancy payload",
        });
      });

      it("should return 201 on success mapping multiple occupancies", async () => {
        req.body = {
          organisationId: "org1",
          userId: "u1",
          occupancies: [
            {
              startTime: "2026-03-07T10:00:00Z",
              endTime: "2026-03-07T11:00:00Z",
              sourceType: "BLOCK",
              referenceId: "ref1",
            },
            {
              startTime: "2026-03-08T10:00:00Z",
              endTime: "2026-03-08T11:00:00Z",
              sourceType: "APPOINTMENT",
            },
          ],
        };

        await AvailabilityController.addAllOccupancies(req, res);

        expect(AvailabilityService.addAllOccupancies).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it("should handle errors", async () => {
        req.body = {
          organisationId: "org1",
          userId: "u1",
          occupancies: [
            {
              startTime: "2026-03-07T10:00:00Z",
              endTime: "2026-03-07T11:00:00Z",
              sourceType: "BLOCK",
            },
          ],
        };
        (AvailabilityService.addAllOccupancies as jest.Mock).mockRejectedValue(
          new Error("err"),
        );
        await AvailabilityController.addAllOccupancies(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("getOccupancy", () => {
      it("should return 400 if filters are missing", async () => {
        req.params.orgId = "org1";
        await AvailabilityController.getOccupancy(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 200 and data on success", async () => {
        req.params.orgId = "org1";
        req.query.startDate = "2026-03-01";
        req.query.endDate = "2026-03-31";
        (AvailabilityService.getOccupancy as jest.Mock).mockResolvedValue(
          "occData",
        );

        await AvailabilityController.getOccupancy(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: "occData" });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.query.startDate = "2026-03-01";
        req.query.endDate = "2026-03-31";
        (AvailabilityService.getOccupancy as jest.Mock).mockRejectedValue(
          new Error("err"),
        );
        await AvailabilityController.getOccupancy(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("Final Availability & Status", () => {
    describe("getFinalAvailability", () => {
      it("should return 400 if parameters are missing", async () => {
        req.params.orgId = "org1";
        await AvailabilityController.getFinalAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 200 and data on success", async () => {
        req.params.orgId = "org1";
        req.query.referenceDate = "2026-03-07";
        (
          AvailabilityService.getFinalAvailabilityForDate as jest.Mock
        ).mockResolvedValue("finalData");

        await AvailabilityController.getFinalAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: "finalData" });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        req.query.referenceDate = "2026-03-07";
        (
          AvailabilityService.getFinalAvailabilityForDate as jest.Mock
        ).mockRejectedValue(new Error("err"));
        await AvailabilityController.getFinalAvailability(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("getCurrentStatus", () => {
      it("should return 400 if parameters are missing", async () => {
        req.params.orgId = undefined;
        await AvailabilityController.getCurrentStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should return 200 and status on success", async () => {
        req.params.orgId = "org1";
        (AvailabilityService.getCurrentStatus as jest.Mock).mockResolvedValue(
          "statusData",
        );

        await AvailabilityController.getCurrentStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: "statusData" });
      });

      it("should handle errors", async () => {
        req.params.orgId = "org1";
        (AvailabilityService.getCurrentStatus as jest.Mock).mockRejectedValue(
          new Error("err"),
        );
        await AvailabilityController.getCurrentStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
