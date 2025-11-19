import BaseAvailabilityModel from "../../src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "../../src/models/weekly-availablity-override";
import OccupancyModel from "../../src/models/occupancy";
import { AvailabilityService } from "../../src/services/availability.service";

type MockedBaseAvailabilityModel = {
  deleteMany: jest.Mock;
  insertMany: jest.Mock;
  find: jest.Mock;
};

type MockedWeeklyOverrideModel = jest.Mock & {
  findOne: jest.Mock;
  deleteOne: jest.Mock;
};

type MockedOccupancyModel = jest.Mock & {
  insertMany: jest.Mock;
  find: jest.Mock;
  exists: jest.Mock;
};

jest.mock("../../src/models/base-availability", () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/weekly-availablity-override", () => {
  const mockConstructor = Object.assign(jest.fn(), {
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  });
  return {
    __esModule: true,
    default: mockConstructor,
  };
});

jest.mock("../../src/models/occupancy", () => {
  const mockConstructor = Object.assign(jest.fn(), {
    insertMany: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
  });
  return {
    __esModule: true,
    default: mockConstructor,
  };
});

const mockedBaseAvailabilityModel =
  BaseAvailabilityModel as unknown as MockedBaseAvailabilityModel;
const mockedWeeklyOverrideModel =
  WeeklyAvailabilityOverrideModel as unknown as MockedWeeklyOverrideModel;
const mockedOccupancyModel = OccupancyModel as unknown as MockedOccupancyModel;

describe("AvailabilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWeeklyOverrideModel.mockImplementation(() => ({ save: jest.fn() }));
    mockedOccupancyModel.mockImplementation(() => ({ save: jest.fn() }));
  });

  describe("setAllBaseAvailability", () => {
    it("replaces base availability with the provided slots", async () => {
      const newDocs = [{ _id: "doc-1" }];
      mockedBaseAvailabilityModel.insertMany.mockResolvedValueOnce(newDocs);

      const result = await AvailabilityService.setAllBaseAvailability(
        "org-1",
        "user-1",
        [
          {
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "17:00", isAvailable: true },
            ],
          },
        ],
      );

      expect(mockedBaseAvailabilityModel.deleteMany).toHaveBeenCalledWith({
        userId: "user-1",
        organisationId: "org-1",
      });
      expect(mockedBaseAvailabilityModel.insertMany).toHaveBeenCalledWith([
        {
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: true }],
          userId: "user-1",
          organisationId: "org-1",
        },
      ]);
      expect(result).toBe(newDocs);
    });
  });

  describe("addWeeklyAvailabilityOverride", () => {
    it("updates an existing override when found", async () => {
      const existingOverride = {
        overrides: [],
        save: jest.fn(),
      };
      mockedWeeklyOverrideModel.findOne.mockResolvedValueOnce(existingOverride);

      const overridePayload = {
        dayOfWeek: "MONDAY" as const,
        slots: [{ startTime: "10:00", endTime: "12:00", isAvailable: true }],
      };

      await AvailabilityService.addWeeklyAvailabilityOverride(
        "org-1",
        "user-1",
        new Date("2025-01-06"),
        overridePayload,
      );

      expect(existingOverride.overrides).toHaveLength(1);
      expect(existingOverride.overrides[0]).toBe(overridePayload);
      expect(existingOverride.save).toHaveBeenCalledTimes(1);
    });

    it("creates a new override document when none exists", async () => {
      const saveMock = jest.fn();
      mockedWeeklyOverrideModel.findOne.mockResolvedValueOnce(null);
      mockedWeeklyOverrideModel.mockImplementationOnce(() => ({
        save: saveMock,
      }));

      const overridePayload = {
        dayOfWeek: "TUESDAY" as const,
        slots: [{ startTime: "11:00", endTime: "13:00", isAvailable: true }],
      };

      await AvailabilityService.addWeeklyAvailabilityOverride(
        "org-2",
        "user-2",
        new Date("2025-01-07"),
        overridePayload,
      );

      expect(mockedWeeklyOverrideModel).toHaveBeenCalledWith({
        organisationId: "org-2",
        userId: "user-2",
        weekStartDate: new Date("2025-01-07"),
        overrides: [overridePayload],
      });
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getFinalAvailability", () => {
    it("merges base availability, overrides, and occupancy blocks", async () => {
      mockedBaseAvailabilityModel.find.mockResolvedValueOnce([
        {
          dayOfWeek: "MONDAY",
          slots: [
            {
              startTime: "2025-01-06T09:00:00.000Z",
              endTime: "2025-01-06T11:00:00.000Z",
              isAvailable: true,
            },
            {
              startTime: "2025-01-06T13:00:00.000Z",
              endTime: "2025-01-06T15:00:00.000Z",
              isAvailable: true,
            },
          ],
        },
        {
          dayOfWeek: "TUESDAY",
          slots: [{ startTime: "10:00", endTime: "12:00", isAvailable: true }],
        },
      ]);

      mockedWeeklyOverrideModel.findOne.mockResolvedValueOnce({
        overrides: [
          {
            dayOfWeek: "TUESDAY",
            slots: [
              {
                startTime: "2025-01-07T14:00:00.000Z",
                endTime: "2025-01-07T16:00:00.000Z",
                isAvailable: true,
              },
            ],
          },
        ],
      });

      mockedOccupancyModel.find.mockResolvedValueOnce([
        {
          startTime: new Date("2025-01-06T09:30:00.000Z"),
          endTime: new Date("2025-01-06T10:30:00.000Z"),
        },
      ]);

      const availability = await AvailabilityService.getWeeklyFinalAvailability(
        "org-1",
        "user-1",
        new Date("2025-01-08"),
      );

      expect(availability).toEqual([
        {
          dayOfWeek: "MONDAY",
          slots: [
            {
              startTime: "2025-01-06T13:00:00.000Z",
              endTime: "2025-01-06T15:00:00.000Z",
              isAvailable: true,
            },
          ],
        },
        {
          dayOfWeek: "TUESDAY",
          slots: [
            {
              startTime: "2025-01-07T14:00:00.000Z",
              endTime: "2025-01-07T16:00:00.000Z",
              isAvailable: true,
            },
          ],
        },
      ]);
    });
  });

  describe("calculateWeeklyHours", () => {
    it("sums only available slot durations", () => {
      const total = AvailabilityService.calculateWeeklyHours({
        "2025-01-06": [
          { startTime: "09:00", endTime: "10:30", isAvailable: true },
          { startTime: "11:00", endTime: "12:00", isAvailable: false },
        ],
        "2025-01-07": [
          { startTime: "14:00", endTime: "18:00", isAvailable: true },
        ],
      });

      expect(total).toBeCloseTo(5.5);
    });
  });

  describe("getCurrentStatus", () => {
    const mondayMorning = new Date(2025, 0, 6, 10, 0, 0);

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns Consulting when an occupancy exists", async () => {
      jest.useFakeTimers().setSystemTime(mondayMorning);
      const availability = [
        {
          dayOfWeek: "MONDAY" as const,
          slots: [{ startTime: "09:00", endTime: "11:00", isAvailable: true }],
        },
      ];
      const spy = jest
        .spyOn(AvailabilityService, "getWeeklyFinalAvailability")
        .mockResolvedValueOnce(availability);
      mockedOccupancyModel.exists.mockResolvedValueOnce(true);

      const status = await AvailabilityService.getCurrentStatus(
        "org-1",
        "user-1",
      );

      expect(status).toBe("Consulting");
      spy.mockRestore();
    });

    it("returns Available when within an active slot", async () => {
      jest.useFakeTimers().setSystemTime(mondayMorning);
      const availability = [
        {
          dayOfWeek: "MONDAY" as const,
          slots: [{ startTime: "09:00", endTime: "11:00", isAvailable: true }],
        },
      ];
      const spy = jest
        .spyOn(AvailabilityService, "getWeeklyFinalAvailability")
        .mockResolvedValueOnce(availability);
      mockedOccupancyModel.exists.mockResolvedValueOnce(false);

      const status = await AvailabilityService.getCurrentStatus(
        "org-1",
        "user-1",
      );

      expect(status).toBe("Available");
      spy.mockRestore();
    });

    it("returns Off-Duty when no slots exist", async () => {
      jest.useFakeTimers().setSystemTime(mondayMorning);
      const spy = jest
        .spyOn(AvailabilityService, "getWeeklyFinalAvailability")
        .mockResolvedValueOnce([]);
      mockedOccupancyModel.exists.mockResolvedValueOnce(false);

      const status = await AvailabilityService.getCurrentStatus(
        "org-1",
        "user-1",
      );

      expect(status).toBe("Off-Duty");
      spy.mockRestore();
    });

    it("returns Requested when no slot is active", async () => {
      jest.useFakeTimers().setSystemTime(mondayMorning);
      const availability = [
        {
          dayOfWeek: "MONDAY" as const,
          slots: [{ startTime: "12:00", endTime: "13:00", isAvailable: true }],
        },
      ];
      const spy = jest
        .spyOn(AvailabilityService, "getWeeklyFinalAvailability")
        .mockResolvedValueOnce(availability);
      mockedOccupancyModel.exists.mockResolvedValueOnce(false);

      const status = await AvailabilityService.getCurrentStatus(
        "org-1",
        "user-1",
      );

      expect(status).toBe("Requested");
      spy.mockRestore();
    });
  });
});
