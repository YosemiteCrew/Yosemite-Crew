import {
  DashboardService,
  SummaryRange,
} from "../../src/services/dashboard.service";
import { AvailabilityService } from "../../src/services/availability.service";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("../../src/services/availability.service", () => ({
  AvailabilityService: {
    getCurrentStatus: jest.fn(),
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
    $queryRaw: jest.fn(),
    userOrganization: {
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
    (AvailabilityService.getCurrentStatus as jest.Mock).mockResolvedValue(
      "Off-Duty",
    );
    (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  // --- 1. getSummary ---
  describe("getSummary", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getSummary({ organisationId: "", range: "today" }),
      ).rejects.toThrow("organisationId is required");
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

    it("should handle empty aggregation results (defaults to 0)", async () => {
      (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { totalAmount: null },
      });

      const result = await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "today",
      });

      expect(result.revenue).toBe(0);
      expect(result.appointments).toBe(0);
      expect(result.tasks).toBe(0);
    });

    it("should count staff currently on duty", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([
        { practitionerReference: "staff-1" },
        { practitionerReference: "staff-2" },
        { practitionerReference: null },
      ]);
      (AvailabilityService.getCurrentStatus as jest.Mock)
        .mockResolvedValueOnce("Consulting")
        .mockResolvedValueOnce("Off-Duty");
      (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { totalAmount: null },
      });

      const result = await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "today",
      });

      expect(result.staffOnDuty).toBe(1);
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
      "last_6_months",
      "last_1_year",
    ];
    test.each(ranges)("should resolve date range for %s", async (range) => {
      (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { totalAmount: null },
      });

      await DashboardService.getSummary({ organisationId: mockOrgId, range });
      // Implicitly checks execution path without throwing
      expect(prisma.appointment.count).toHaveBeenCalled();
    });

    it("should fallback to default range logic for unknown inputs", async () => {
      (prisma.appointment.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.task.count as jest.Mock).mockResolvedValueOnce(0);
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { totalAmount: null },
      });
      await DashboardService.getSummary({
        organisationId: mockOrgId,
        range: "unknown" as SummaryRange,
      });
      expect(prisma.appointment.count).toHaveBeenCalled();
    });
  });

  // --- 2. getAppointmentsTrend ---
  describe("getAppointmentsTrend", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getAppointmentsTrend({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should aggregate appointment statuses", async () => {
      const today = new Date();
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
        { startTime: today, status: "COMPLETED" },
        { startTime: today, status: "CANCELLED" },
      ]);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: mockOrgId,
        range: "today",
        bucket: "day",
      });

      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(1);
      expect(result[0].cancelled).toBe(1);
    });

    it("should default status counts to 0 for other statuses", async () => {
      const today = new Date();
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
        { startTime: today, status: "PENDING" },
      ]);

      const result = await DashboardService.getAppointmentsTrend({
        organisationId: mockOrgId,
        range: "today",
        bucket: "day",
      });

      expect(result[0].completed).toBe(0);
      expect(result[0].cancelled).toBe(0);
    });
  });

  // --- 3. getRevenueTrend ---
  describe("getRevenueTrend", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getRevenueTrend({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should aggregate paid invoices", async () => {
      const today = new Date();
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          bucket: today,
          revenue: 150,
          paidRevenue: 150,
          cancelledRevenue: 0,
        },
      ]);

      const result = await DashboardService.getRevenueTrend({
        organisationId: mockOrgId,
        range: "today",
        bucket: "day",
      });

      expect(result[0].revenue).toBe(150);
      expect(result[0].paidRevenue).toBe(150);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should track cancelled revenue separately", async () => {
      const today = new Date();
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          bucket: today,
          revenue: 0,
          paidRevenue: 0,
          cancelledRevenue: 75,
        },
      ]);

      const result = await DashboardService.getRevenueTrend({
        organisationId: mockOrgId,
        range: "today",
        bucket: "day",
      });

      expect(result[0].revenue).toBe(0);
      expect(result[0].cancelledRevenue).toBe(75);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  // --- 4. getAppointmentLeaders ---
  describe("getAppointmentLeaders", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getAppointmentLeaders({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
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

    it("should ignore rows without a valid lead", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
        { lead: null },
        { lead: {} },
        { lead: { id: "staff-1" } },
      ]);

      const result = await DashboardService.getAppointmentLeaders({
        organisationId: mockOrgId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].staffId).toBe("staff-1");
    });
  });

  // --- 5. getRevenueLeaders ---
  describe("getRevenueLeaders", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getRevenueLeaders({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
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
      expect(leader?.serviceKey).toBe("A");
    });

    it("should label items without a name as Unknown", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        { items: [{ total: 50 }] },
      ]);

      const result = await DashboardService.getRevenueLeaders({
        organisationId: mockOrgId,
      });

      expect(result[0].label).toBe("Unknown");
      expect(result[0].revenue).toBe(50);
    });
  });

  // --- 6. getInventoryTurnover ---
  describe("getInventoryTurnover", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getInventoryTurnover({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
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

    it("should default avg on-hand to 1 to avoid division by zero", async () => {
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "item-1", onHand: 0, name: "Item A" },
      ]);
      (
        prisma.inventoryStockMovement.findMany as jest.Mock
      ).mockResolvedValueOnce([
        { itemId: "item-1", change: -100, createdAt: new Date("2023-01-05") },
      ]);

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
        year: 2023,
      });

      expect(result.turnsPerYear).toBe(100);
    });

    it("should return null restock cycle for zero turnover", async () => {
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "item-1", onHand: 10, name: "Item A" },
      ]);
      (
        prisma.inventoryStockMovement.findMany as jest.Mock
      ).mockResolvedValueOnce([]);

      const result = await DashboardService.getInventoryTurnover({
        organisationId: mockOrgId,
        year: 2023,
      });

      expect(result.turnsPerYear).toBe(0);
      expect(result.restockCycleDays).toBeNull();
    });
  });

  // --- 7. getProductTurnover ---
  describe("getProductTurnover", () => {
    it("should throw if organisationId is missing", async () => {
      await expect(
        DashboardService.getProductTurnover({ organisationId: "" }),
      ).rejects.toThrow("organisationId is required");
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

    it("should default on-hand to 1 when the item has none", async () => {
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "item-1", name: "Item A", onHand: 0 },
      ]);
      (
        prisma.inventoryStockMovement.findMany as jest.Mock
      ).mockResolvedValueOnce([{ itemId: "item-1", change: -10 }]);

      const result = await DashboardService.getProductTurnover({
        organisationId: mockOrgId,
        year: 2023,
      });

      expect(result[0].turnover).toBe(10);
    });
  });
});
