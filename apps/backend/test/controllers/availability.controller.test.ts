import { AvailabilityController } from "src/controllers/web/availability.controller";
import { AvailabilityService } from "src/services/availability.service";
import logger from "src/utils/logger";

jest.mock("src/services/availability.service", () => ({
  AvailabilityService: {
    setAllBaseAvailability: jest.fn(),
    getBaseAvailability: jest.fn(),
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

const mockedService = AvailabilityService as unknown as {
  setAllBaseAvailability: jest.Mock;
  addAllOccupancies: jest.Mock;
  getFinalAvailabilityForDate: jest.Mock;
  getCurrentStatus: jest.Mock;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("AvailabilityController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects base availability without user", async () => {
    const req = {
      params: { orgId: "org-1" },
      body: { availabilities: [] },
      headers: {},
    } as any;
    const res = mockResponse();

    await AvailabilityController.setAllBaseAvailability(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing or invalid payload",
    });
    expect(mockedService.setAllBaseAvailability).not.toHaveBeenCalled();
  });

  it("sets base availability for user", async () => {
    const req = {
      params: { orgId: "org-1" },
      headers: { "x-user-id": "user-1" },
      body: { availabilities: [{ dayOfWeek: "MONDAY", slots: [] }] },
    } as any;
    const res = mockResponse();
    mockedService.setAllBaseAvailability.mockResolvedValueOnce([{ id: 1 }]);

    await AvailabilityController.setAllBaseAvailability(req, res as any);

    expect(mockedService.setAllBaseAvailability).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      req.body.availabilities,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Base availability saved",
      data: [{ id: 1 }],
    });
  });

  it("normalizes occupancy payloads before saving all", async () => {
    const req = {
      body: {
        organisationId: "org-1",
        userId: "user-1",
        occupancies: [
          {
            startTime: "2024-01-01T10:00:00Z",
            endTime: "2024-01-01T11:00:00Z",
            sourceType: "APPOINTMENT",
            referenceId: "ref-1",
          },
        ],
      },
    } as any;
    const res = mockResponse();

    await AvailabilityController.addAllOccupancies(req, res as any);

    expect(mockedService.addAllOccupancies).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          sourceType: "APPOINTMENT",
          referenceId: "ref-1",
        }),
      ]),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns 400 when reference date missing", async () => {
    const req = {
      params: { orgId: "org-1" },
      query: {},
      headers: { "x-user-id": "user-1" },
    } as any;
    const res = mockResponse();

    await AvailabilityController.getFinalAvailability(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing parameters" });
  });

  it("logs and maps unexpected errors in current status", async () => {
    const req = {
      params: { orgId: "org-1" },
      headers: { "x-user-id": "user-1" },
    } as any;
    const res = mockResponse();
    const error = new Error("boom");
    mockedService.getCurrentStatus.mockRejectedValueOnce(error);

    await AvailabilityController.getCurrentStatus(req, res as any);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "getCurrentStatus error",
      error,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "boom" });
  });
});
