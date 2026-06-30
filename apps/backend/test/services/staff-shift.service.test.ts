jest.mock("src/config/prisma", () => ({
  prisma: {
    staffShift: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import {
  StaffShiftService,
  StaffShiftError,
} from "../../src/services/staff-shift.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const shiftDate = new Date("2026-07-01T00:00:00Z");
const startTime = new Date("2026-07-01T09:00:00Z");
const endTime = new Date("2026-07-01T17:00:00Z");

const baseShift = {
  id: "shift-1",
  organisationId: "org-1",
  staffId: "staff-1",
  role: "VET",
  shiftDate,
  startTime,
  endTime,
  breakMinutes: 30,
  status: "SCHEDULED" as const,
  notes: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("StaffShiftService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("schedule", () => {
    it("creates a shift in SCHEDULED status", async () => {
      (mockedPrisma.staffShift.create as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const result = await StaffShiftService.schedule({
        organisationId: "org-1",
        staffId: "staff-1",
        role: "VET",
        shiftDate,
        startTime,
        endTime,
        createdBy: "admin-1",
      });
      expect(result.status).toBe("SCHEDULED");
      const data = (mockedPrisma.staffShift.create as jest.Mock).mock
        .calls[0][0].data;
      expect(data.status).toBe("SCHEDULED");
    });

    it("throws 400 when endTime <= startTime", async () => {
      await expect(
        StaffShiftService.schedule({
          organisationId: "org-1",
          staffId: "staff-1",
          role: "VET",
          shiftDate,
          startTime: endTime,
          endTime: startTime,
        }),
      ).rejects.toThrow(StaffShiftError);
    });
  });

  describe("get", () => {
    it("returns shift when found", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const result = await StaffShiftService.get("shift-1", "org-1");
      expect(result.id).toBe("shift-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(StaffShiftService.get("x", "org-1")).rejects.toThrow(
        StaffShiftError,
      );
    });
  });

  describe("list", () => {
    it("lists all shifts for organisation", async () => {
      (mockedPrisma.staffShift.findMany as jest.Mock).mockResolvedValue([
        baseShift,
      ]);
      const result = await StaffShiftService.list({ organisationId: "org-1" });
      expect(result).toHaveLength(1);
    });

    it("filters by staffId and status", async () => {
      (mockedPrisma.staffShift.findMany as jest.Mock).mockResolvedValue([]);
      await StaffShiftService.list({
        organisationId: "org-1",
        staffId: "staff-1",
        status: "SCHEDULED",
      });
      const where = (mockedPrisma.staffShift.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.staffId).toBe("staff-1");
      expect(where.status).toBe("SCHEDULED");
    });

    it("applies date range filter", async () => {
      (mockedPrisma.staffShift.findMany as jest.Mock).mockResolvedValue([]);
      await StaffShiftService.list({
        organisationId: "org-1",
        date: new Date("2026-07-01"),
      });
      const where = (mockedPrisma.staffShift.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.shiftDate).toBeDefined();
    });
  });

  describe("start", () => {
    it("transitions SCHEDULED to IN_PROGRESS", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const inProgress = { ...baseShift, status: "IN_PROGRESS" as const };
      (mockedPrisma.staffShift.update as jest.Mock).mockResolvedValue(
        inProgress,
      );
      const result = await StaffShiftService.start("shift-1", "org-1");
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("throws 409 for terminal COMPLETED", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue({
        ...baseShift,
        status: "COMPLETED",
      });
      await expect(StaffShiftService.start("shift-1", "org-1")).rejects.toThrow(
        StaffShiftError,
      );
    });
  });

  describe("complete", () => {
    it("completes a shift", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue({
        ...baseShift,
        status: "IN_PROGRESS",
      });
      const completed = { ...baseShift, status: "COMPLETED" as const };
      (mockedPrisma.staffShift.update as jest.Mock).mockResolvedValue(
        completed,
      );
      const result = await StaffShiftService.complete("shift-1", "org-1");
      expect(result.status).toBe("COMPLETED");
    });

    it("throws 409 for terminal CANCELLED", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue({
        ...baseShift,
        status: "CANCELLED",
      });
      await expect(
        StaffShiftService.complete("shift-1", "org-1"),
      ).rejects.toThrow(StaffShiftError);
    });
  });

  describe("cancel", () => {
    it("cancels a scheduled shift", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const cancelled = { ...baseShift, status: "CANCELLED" as const };
      (mockedPrisma.staffShift.update as jest.Mock).mockResolvedValue(
        cancelled,
      );
      const result = await StaffShiftService.cancel(
        "shift-1",
        "org-1",
        "admin-1",
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("throws 409 for NO_SHOW", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue({
        ...baseShift,
        status: "NO_SHOW",
      });
      await expect(
        StaffShiftService.cancel("shift-1", "org-1"),
      ).rejects.toThrow(StaffShiftError);
    });
  });

  describe("markNoShow", () => {
    it("marks a scheduled shift as NO_SHOW", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const noShow = { ...baseShift, status: "NO_SHOW" as const };
      (mockedPrisma.staffShift.update as jest.Mock).mockResolvedValue(noShow);
      const result = await StaffShiftService.markNoShow("shift-1", "org-1");
      expect(result.status).toBe("NO_SHOW");
    });
  });

  describe("update", () => {
    it("updates notes on a scheduled shift", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      const updated = { ...baseShift, notes: "Updated notes" };
      (mockedPrisma.staffShift.update as jest.Mock).mockResolvedValue(updated);
      const result = await StaffShiftService.update("shift-1", "org-1", {
        notes: "Updated notes",
      });
      expect(result.notes).toBe("Updated notes");
    });

    it("throws 400 when new endTime <= startTime", async () => {
      (mockedPrisma.staffShift.findFirst as jest.Mock).mockResolvedValue(
        baseShift,
      );
      await expect(
        StaffShiftService.update("shift-1", "org-1", {
          startTime: endTime,
          endTime: startTime,
        }),
      ).rejects.toThrow(StaffShiftError);
    });
  });
});
