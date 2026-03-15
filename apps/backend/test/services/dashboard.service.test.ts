import {
  DashboardService,
  SummaryRange,
} from "../../src/services/dashboard.service";
import AppointmentModel from "../../src/models/appointment";
import TaskModel from "../../src/models/task";
import InvoiceModel from "../../src/models/invoice";
import {
  InventoryItemModel,
  StockMovementModel,
} from "../../src/models/inventory";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("../../src/models/appointment");
jest.mock("../../src/models/task");
jest.mock("../../src/models/invoice");
jest.mock("../../src/models/inventory", () => ({
  InventoryItemModel: {
    find: jest.fn(),
  },
  StockMovementModel: {
    aggregate: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
    },
    inventoryStockMovement: {
      findMany: jest.fn(),
    },
  },
}));

describe("DashboardService", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. getSummary ---
  describe("getSummary", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getSummary({ organisationId: "", range: "today" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should return summary data correctly", async () => {
      // Mock Appointment Aggregation
      const mockAgg = [{ _id: null, revenue: 0, count: 5 }];
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      // Mock Invoice Aggregation
      const mockRevenueAgg = [{ _id: null, revenue: 1000, count: 1 }];
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue(mockRevenueAgg);

      // Mock Task Count
      const mockTaskCount = { exec: jest.fn().mockResolvedValue(10) };
      (TaskModel.countDocuments as jest.Mock).mockReturnValue(mockTaskCount);

      const result = await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "today",
      });

      expect(AppointmentModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        revenue: 1000,
        appointments: 5,
        tasks: 10,
        staffOnDuty: 0,
      });
    });

    it("should handle empty aggregation results (defaults to 0)", async () => {
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue([]);
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue([]);
      (TaskModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "today",
      });

      expect(result.revenue).toBe(0);
      expect(result.appointments).toBe(0);
    });

    // Test different ranges to cover switch case in resolveRange
    const ranges: SummaryRange[] = [
      "today",
      "yesterday",
      "last_7_days",
      "last_30_days",
      "this_week",
      "last_week",
      "this_month",
      "last_month",
    ];
    test.each(ranges)("should resolve date range for %s", async (range) => {
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue([]);
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue([]);
      (TaskModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await DashboardService.getSummary({ organisationId: mockOrgId, range });
      // Implicitly checks execution path without throwing
      expect(AppointmentModel.aggregate).toHaveBeenCalled();
    });

    it("should fallback to default range logic for unknown inputs", async () => {
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue([]);
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue([]);
      (TaskModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "unknown" as SummaryRange,
      });
      expect(AppointmentModel.aggregate).toHaveBeenCalled();
    });
  });

  describe("getSummary (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.appointment.count as jest.Mock).mockReset();
      (prisma.task.count as jest.Mock).mockReset();
      (prisma.invoice.aggregate as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should return summary data from prisma", async () => {
      (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(3);
      (prisma.task.count as jest.Mock).mockResolvedValueOnce(7);
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { totalAmount: 250 },
      });

      const result = await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "today",
      });

      expect(result).toEqual({
        revenue: 250,
        appointments: 3,
        tasks: 7,
        staffOnDuty: 0,
      });
    });
  });

  // --- 2. getAppointmentsTrend ---
  describe("getAppointmentsTrend", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getAppointmentsTrend({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should return trend data", async () => {
      const mockAgg = [
        { _id: { year: 2023, month: 1 }, completed: 10, cancelled: 2 },
        { _id: { year: 2023, month: 2 }, completed: 15, cancelled: 0 },
      ];
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: mockOrgId,
      });

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Jan");
      expect(result[0].completed).toBe(10);
    });

    it("should handle empty aggregation fields (defaults)", async () => {
      const mockAgg = [{ _id: { year: 2023, month: 1 } }]; // missing completed/cancelled
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: mockOrgId,
      });
      expect(result[0].completed).toBe(0);
      expect(result[0].cancelled).toBe(0);
    });
  });

  describe("getAppointmentsTrend (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.appointment.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should aggregate appointment statuses", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
        { startTime: new Date("2023-01-05"), status: "COMPLETED" },
        { startTime: new Date("2023-01-06"), status: "CANCELLED" },
        { startTime: new Date("2023-02-01"), status: "COMPLETED" },
      ]);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: mockOrgId,
      });

      expect(result).toHaveLength(2);
      expect(result[0].completed + result[0].cancelled).toBe(2);
    });
  });

  // --- 3. getRevenueTrend ---
  describe("getRevenueTrend", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getRevenueTrend({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should return revenue trend", async () => {
      const mockAgg = [{ _id: { year: 2023, month: 1 }, revenue: 5000 }];
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      const result = await DashboardService.getRevenueTrend({
        organisationId: mockOrgId,
      });
      expect(result[0].revenue).toBe(5000);
      expect(result[0].label).toBe("Jan");
    });
  });

  describe("getRevenueTrend (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.invoice.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should aggregate paid invoices", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        { paidAt: new Date("2023-01-10"), totalAmount: 100 },
        { paidAt: new Date("2023-01-15"), totalAmount: 50 },
      ]);

      const result = await DashboardService.getRevenueTrend({
        organisationId: mockOrgId,
      });

      expect(result[0].revenue).toBe(150);
    });
  });

  // --- 4. getAppointmentLeaders ---
  describe("getAppointmentLeaders", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getAppointmentLeaders({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should return leaders", async () => {
      const mockAgg = [
        { _id: "staff-1", completedAppointments: 20 },
        { _id: null, completedAppointments: 5 }, // Unknown staff
      ];
      (AppointmentModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      const result = await DashboardService.getAppointmentLeaders({
        organisationId: mockOrgId,
      });

      expect(result).toHaveLength(2);
      expect(result[0].staffId).toBe("staff-1");
      expect(result[1].staffId).toBe("unknown");
    });
  });

  describe("getAppointmentLeaders (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.appointment.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should compute leaders from lead ids", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
        { lead: { id: "staff-1" } },
        { lead: { id: "staff-1" } },
        { lead: { id: "staff-2" } },
      ]);

      const result = await DashboardService.getAppointmentLeaders({
        organisationId: mockOrgId,
      });

      expect(result[0].staffId).toBe("staff-1");
      expect(result[0].completedAppointments).toBe(2);
    });
  });

  // --- 5. getRevenueLeaders ---
  describe("getRevenueLeaders", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getRevenueLeaders({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should return revenue leaders", async () => {
      const mockAgg = [
        { _id: "SOP-A", revenue: 1000 },
        { _id: null, revenue: 500 },
      ];
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue(mockAgg);

      const result = await DashboardService.getRevenueLeaders({
        organisationId: mockOrgId,
      });

      expect(result[0].serviceKey).toBe("SOP-A");
      expect(result[1].label).toBe("Unknown");
      expect(result[1].revenue).toBe(500);
    });
  });

  describe("getRevenueLeaders (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.invoice.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should aggregate item totals", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        {
          items: [
            { name: "A", total: 100 },
            { name: "B", total: 50 },
          ],
        },
        { items: [{ name: "A", total: 25 }] },
      ]);

      const result = await DashboardService.getRevenueLeaders({
        organisationId: mockOrgId,
      });

      const leader = result.find((entry) => entry.label === "A");
      expect(leader?.revenue).toBe(125);
    });
  });

  // --- 6. getInventoryTurnover ---
  describe("getInventoryTurnover", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getInventoryTurnover({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should calculate turnover correctly", async () => {
      // Mock Consumption Aggregation
      (StockMovementModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalConsumed: 100 }]) // First call: total consumption
        .mockResolvedValueOnce([
          // Second call: monthly trend
          { _id: { year: 2023, month: 1 }, consumed: 10 },
        ]);

      // Mock Inventory Items (for onHand average)
      // totalOnHand = 10 + 0 = 10. Avg = 10.
      (InventoryItemModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([{ onHand: 10 }, { onHand: undefined }]),
        }),
      });

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
      });

      // Turns = TotalConsumed (100) / TotalOnHand (10) = 10
      expect(result.turnsPerYear).toBe(10);
      // Days = 365 / 10 = 36.5 -> 37
      expect(result.restockCycleDays).toBe(37);
      // Trend calculation: 10 (consumed) / 10 (avgOnHand) = 1
      expect(result.trend[0].turnover).toBe(1);
    });

    it("should handle zero onHand (avoid division by zero)", async () => {
      (StockMovementModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ totalConsumed: 100 }])
        .mockResolvedValueOnce([]); // No monthly trend

      (InventoryItemModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]), // No items
        }),
      });

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
      });

      // totalOnHand = 0 -> avgOnHand defaults to 1
      expect(result.turnsPerYear).toBe(100);
    });

    it("should handle zero turnover", async () => {
      (StockMovementModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([]) // No consumption
        .mockResolvedValueOnce([]);

      (InventoryItemModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ onHand: 10 }]),
        }),
      });

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
      });
      expect(result.turnsPerYear).toBe(0);
      expect(result.restockCycleDays).toBeNull();
    });
  });

  describe("getInventoryTurnover (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findMany as jest.Mock).mockReset();
      (prisma.inventoryStockMovement.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should compute turnover and trend", async () => {
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "item-1", onHand: 10, name: "Item A" },
      ]);
      (
        prisma.inventoryStockMovement.findMany as jest.Mock
      ).mockResolvedValueOnce([
        { itemId: "item-1", change: -20, createdAt: new Date("2023-01-05") },
      ]);

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
        year: 2023,
      });

      expect(result.turnsPerYear).toBe(2);
      expect(result.trend.length).toBe(1);
    });
  });

  // --- 7. getProductTurnover ---
  describe("getProductTurnover", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getProductTurnover({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should calculate product turnover", async () => {
      const itemId = "item-1";
      // Mock Aggregation
      const aggResult = [{ _id: itemId, consumed: 50 }];
      (StockMovementModel.aggregate as jest.Mock).mockResolvedValue(aggResult);

      // Mock Item Lookup
      const items = [{ _id: itemId, name: "Product A", onHand: 5 }];
      (InventoryItemModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(items),
        }),
      });

      const result = await DashboardService.getProductTurnover({
        organisationId: mockOrgId,
      });

      // Turnover = 50 (consumed) / 5 (onHand) = 10
      expect(result[0].turnover).toBe(10);
      expect(result[0].name).toBe("Product A");
    });

    it("should handle unknown items and zero onHand", async () => {
      const itemId = "item-unknown";
      (StockMovementModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: itemId, consumed: 10 },
      ]);

      (InventoryItemModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]), // Item not found in DB
        }),
      });

      const result = await DashboardService.getProductTurnover({
        organisationId: mockOrgId,
      });

      expect(result[0].name).toBe("Unknown");
      // onHand defaults to 0 -> avg defaults to 1. Turnover = 10 / 1 = 10.
      expect(result[0].turnover).toBe(10);
    });
  });

  describe("getProductTurnover (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findMany as jest.Mock).mockReset();
      (prisma.inventoryStockMovement.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should compute product turnover from movements", async () => {
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "item-1", name: "Item A", onHand: 5 },
      ]);
      (
        prisma.inventoryStockMovement.findMany as jest.Mock
      ).mockResolvedValueOnce([{ itemId: "item-1", change: -25 }]);

      const result = await DashboardService.getProductTurnover({
        organisationId: mockOrgId,
        year: 2023,
      });

      expect(result[0]).toEqual({
        itemId: "item-1",
        name: "Item A",
        turnover: 5,
      });
    });
  });
});
