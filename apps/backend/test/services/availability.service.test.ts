import BaseAvailabilityModel from "src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "src/models/weekly-availablity-override";
import { OccupancyModel } from "src/models/occupancy";
import { AvailabilityService } from "src/services/availability.service";

jest.mock("src/models/base-availability", () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("src/models/weekly-availablity-override", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("src/models/occupancy", () => ({
  __esModule: true,
  OccupancyModel: {
    create: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
  },
}));

const mockedBaseModel = BaseAvailabilityModel as unknown as {
  deleteMany: jest.Mock;
  insertMany: jest.Mock;
  find: jest.Mock;
};

const mockedWeeklyModel = WeeklyAvailabilityOverrideModel as unknown as {
  findOne: jest.Mock;
  deleteOne: jest.Mock;
};

const mockedOccupancyModel = OccupancyModel as unknown as {
  create: jest.Mock;
  insertMany: jest.Mock;
  find: jest.Mock;
  exists: jest.Mock;
};

describe("AvailabilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets all base availability", async () => {
    mockedBaseModel.insertMany.mockResolvedValueOnce([]);

    await AvailabilityService.setAllBaseAvailability("org-1", "user-1", [
      {
        dayOfWeek: "MONDAY",
        slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
      },
    ]);

    expect(mockedBaseModel.deleteMany).toHaveBeenCalledWith({
      userId: "user-1",
      organisationId: "org-1",
    });
    expect(mockedBaseModel.insertMany).toHaveBeenCalledWith([
      {
        organisationId: "org-1",
        userId: "user-1",
        dayOfWeek: "MONDAY",
        slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
      },
    ]);
  });

  it("adds all occupancies with organisation/user metadata", async () => {
    mockedOccupancyModel.insertMany.mockResolvedValueOnce([]);

    await AvailabilityService.addAllOccupancies("org-1", "user-1", [
      {
        startTime: new Date("2024-01-01T09:00:00Z"),
        endTime: new Date("2024-01-01T10:00:00Z"),
        sourceType: "APPOINTMENT",
      },
    ]);

    expect(mockedOccupancyModel.insertMany).toHaveBeenCalledWith([
      {
        startTime: new Date("2024-01-01T09:00:00Z"),
        endTime: new Date("2024-01-01T10:00:00Z"),
        sourceType: "APPOINTMENT",
        organisationId: "org-1",
        userId: "user-1",
      },
    ]);
  });

  it("merges availability with occupancies for the week", async () => {
    mockedBaseModel.find.mockResolvedValueOnce([
      {
        dayOfWeek: "MONDAY",
        slots: [{ startTime: "09:00", endTime: "12:00", isAvailable: true }],
      },
    ]);
    mockedWeeklyModel.findOne.mockResolvedValueOnce(null);
    mockedOccupancyModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          startTime: new Date("2024-06-03T10:00:00Z"),
          endTime: new Date("2024-06-03T11:00:00Z"),
        },
      ]),
    });

    const result = await AvailabilityService.getWeeklyFinalAvailability(
      "org-1",
      "user-1",
      new Date("2024-06-05T00:00:00Z"),
    );

    const monday = result.find((d) => d.dayOfWeek === "MONDAY");
    expect(monday?.slots).toEqual([
      { startTime: "09:00", endTime: "10:00", isAvailable: true },
      { startTime: "11:00", endTime: "12:00", isAvailable: true },
    ]);
  });
});
