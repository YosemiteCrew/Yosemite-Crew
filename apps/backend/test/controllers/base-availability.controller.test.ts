import { BaseAvailabilityController } from "../../src/controllers/web/base-availability.controller";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "../../src/services/base-availability.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/base-availability.service", () => {
  const actual = jest.requireActual(
    "../../src/services/base-availability.service",
  );
  return {
    ...actual,
    BaseAvailabilityService: {
      create: jest.fn(),
      update: jest.fn(),
      getByUserId: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = BaseAvailabilityService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  getByUserId: jest.Mock;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("BaseAvailabilityController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("rejects invalid body", async () => {
      const req = { body: null } as any;
      const res = mockResponse();

      await BaseAvailabilityController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid request body.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("creates availability", async () => {
      const req = {
        body: {
          userId: "user-1",
          availability: [
            {
              dayOfWeek: "MONDAY",
              slots: [
                { startTime: "09:00", endTime: "10:00", isAvailable: true },
              ],
            },
          ],
        },
      } as any;
      const res = mockResponse();
      const availability = [
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
        },
      ];
      mockedService.create.mockResolvedValueOnce(availability);

      await BaseAvailabilityController.create(req, res as any);

      expect(mockedService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(availability);
    });

    it("maps service error", async () => {
      const req = { body: { userId: "user-1", availability: [] } } as any;
      const res = mockResponse();
      mockedService.create.mockRejectedValueOnce(
        new BaseAvailabilityServiceError("Invalid", 422),
      );

      await BaseAvailabilityController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid" });
    });

    it("logs unexpected error", async () => {
      const req = { body: { userId: "user-1", availability: [] } } as any;
      const res = mockResponse();
      const error = new Error("oops");
      mockedService.create.mockRejectedValueOnce(error);

      await BaseAvailabilityController.create(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to create base availability",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to create base availability.",
      });
    });
  });

  describe("update", () => {
    it("updates availability", async () => {
      const req = {
        params: { userId: "user-1" },
        body: {
          availability: [
            {
              dayOfWeek: "MONDAY",
              slots: [
                { startTime: "09:00", endTime: "10:00", isAvailable: true },
              ],
            },
          ],
        },
      } as any;
      const res = mockResponse();
      const availability = [
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
        },
      ];
      mockedService.update.mockResolvedValueOnce(availability);

      await BaseAvailabilityController.update(req, res as any);

      expect(mockedService.update).toHaveBeenCalledWith("user-1", req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(availability);
    });

    it("maps service error", async () => {
      const req = { params: { userId: "user-1" }, body: {} } as any;
      const res = mockResponse();
      mockedService.update.mockRejectedValueOnce(
        new BaseAvailabilityServiceError("Invalid", 400),
      );

      await BaseAvailabilityController.update(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid" });
    });

    it("logs unexpected error", async () => {
      const req = { params: { userId: "user-1" }, body: {} } as any;
      const res = mockResponse();
      const error = new Error("fail");
      mockedService.update.mockRejectedValueOnce(error);

      await BaseAvailabilityController.update(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to update base availability",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to update base availability.",
      });
    });
  });

  describe("getByUserId", () => {
    it("returns availability", async () => {
      const req = { params: { userId: "user-1" } } as any;
      const res = mockResponse();
      const availability = [
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
        },
      ];
      mockedService.getByUserId.mockResolvedValueOnce(availability);

      await BaseAvailabilityController.getByUserId(req, res as any);

      expect(mockedService.getByUserId).toHaveBeenCalledWith("user-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(availability);
    });

    it("returns 404 when missing", async () => {
      const req = { params: { userId: "missing" } } as any;
      const res = mockResponse();
      mockedService.getByUserId.mockResolvedValueOnce([]);

      await BaseAvailabilityController.getByUserId(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Base availability not found.",
      });
    });

    it("maps service error", async () => {
      const req = { params: { userId: "" } } as any;
      const res = mockResponse();
      mockedService.getByUserId.mockRejectedValueOnce(
        new BaseAvailabilityServiceError("Invalid", 400),
      );

      await BaseAvailabilityController.getByUserId(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid" });
    });

    it("logs unexpected error", async () => {
      const req = { params: { userId: "user-1" } } as any;
      const res = mockResponse();
      const error = new Error("db");
      mockedService.getByUserId.mockRejectedValueOnce(error);

      await BaseAvailabilityController.getByUserId(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to retrieve base availability",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to retrieve base availability.",
      });
    });
  });
});
