import dayjs from "dayjs";
import AppointmentModel from "src/models/appointment";
import TaskModel from "src/models/task";
import { InventoryItemModel, StockMovementModel } from "src/models/inventory";
import {
  DashboardService,
  DashboardServiceError,
} from "src/services/dashboard.service";

jest.mock("src/models/appointment", () => ({
  __esModule: true,
  default: { aggregate: jest.fn() },
}));

jest.mock("src/models/task", () => ({
  __esModule: true,
  default: { countDocuments: jest.fn() },
}));

jest.mock("src/models/inventory", () => ({
  __esModule: true,
  InventoryItemModel: { find: jest.fn() },
  StockMovementModel: { aggregate: jest.fn() },
}));

const mockedAppointmentModel = AppointmentModel as unknown as {
  aggregate: jest.Mock;
};

const mockedTaskModel = TaskModel as unknown as {
  countDocuments: jest.Mock;
};

const mockedInventoryItemModel = InventoryItemModel as unknown as {
  find: jest.Mock;
};

const mockedStockMovementModel = StockMovementModel as unknown as {
  aggregate: jest.Mock;
};

describe("DashboardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getSummary", () => {
    it("returns summary aggregates", async () => {
      mockedAppointmentModel.aggregate.mockResolvedValueOnce([
        { _id: null, revenue: 1500, count: 3 },
      ]);
      mockedTaskModel.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(7),
      });

      const result = await DashboardService.getSummary({
        organisationId: "org-1",
        range: "last_week",
      });

      expect(mockedAppointmentModel.aggregate).toHaveBeenCalled();
      expect(mockedTaskModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: "org-1" }),
      );
      expect(result).toEqual({
        revenue: 1500,
        appointments: 3,
        tasks: 7,
        staffOnDuty: 0,
      });
    });

    it("throws when organisationId missing", async () => {
      await expect(
        DashboardService.getSummary({ organisationId: "", range: "today" }),
      ).rejects.toBeInstanceOf(DashboardServiceError);
    });
  });

  describe("getAppointmentsTrend", () => {
    it("maps aggregate rows into trend points", async () => {
      mockedAppointmentModel.aggregate.mockResolvedValueOnce([
        { _id: { year: 2024, month: 5 }, completed: 2, cancelled: 1 },
      ]);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: "org-1",
        months: 3,
      });

      expect(result).toEqual([
        {
          label: dayjs().month(4).format("MMM"),
          year: 2024,
          month: 5,
          completed: 2,
          cancelled: 1,
        },
      ]);
    });
  });

  describe("getInventoryTurnover", () => {
    it("computes turnover and monthly trend", async () => {
      mockedStockMovementModel.aggregate
        .mockResolvedValueOnce([{ _id: null, totalConsumed: 120 }]) // consumptionAgg
        .mockResolvedValueOnce([
          { _id: { year: 2024, month: 1 }, consumed: 30 },
        ]); // monthlyAgg

      mockedInventoryItemModel.find.mockReturnValueOnce({
        lean: () => ({
          exec: jest.fn().mockResolvedValueOnce([
            { _id: "i1", onHand: 40 },
            { _id: "i2", onHand: 20 },
          ]),
        }),
      });

      const result = await DashboardService.getInventoryTurnover({
        organisationId: "org-1",
        year: 2024,
        targetTurnsPerYear: 10,
      });

      expect(result.turnsPerYear).toBeCloseTo(2, 5);
      expect(result.restockCycleDays).toBeCloseTo(183, 0);
      expect(result.trend).toEqual([
        { month: "Jan", year: 2024, turnover: 0.5 },
      ]);
    });
  });

  describe("getProductTurnover", () => {
    it("returns item turnover ordered set", async () => {
      mockedStockMovementModel.aggregate.mockResolvedValueOnce([
        { _id: "item-1", consumed: 10 },
      ]);

      mockedInventoryItemModel.find.mockReturnValueOnce({
        lean: () => ({
          exec: jest
            .fn()
            .mockResolvedValueOnce([
              { _id: "item-1", onHand: 5, name: "Item 1" },
            ]),
        }),
      });

      const result = await DashboardService.getProductTurnover({
        organisationId: "org-1",
        year: 2024,
        limit: 1,
      });

      expect(result).toEqual([
        { itemId: "item-1", name: "Item 1", turnover: 2 },
      ]);
    });
  });
});
