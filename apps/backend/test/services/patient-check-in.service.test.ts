jest.mock("src/config/prisma", () => ({
  prisma: {
    patientCheckIn: {
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
  PatientCheckInService,
  PatientCheckInError,
} from "../../src/services/patient-check-in.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const arrivedAt = new Date("2026-06-30T09:00:00Z");
const baseCheckIn = {
  id: "checkin-1",
  organisationId: "org-1",
  patientId: "patient-1",
  clientId: "client-1",
  appointmentId: null,
  arrivedAt,
  triagePriority: "NON_URGENT" as const,
  triageNote: null,
  assignedRoomId: null,
  checkedInBy: "receptionist-1",
  waitStartedAt: new Date("2026-06-30T09:00:00Z"),
  seenAt: null,
  waitMinutes: null,
  status: "WAITING" as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PatientCheckInService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("creates a check-in in WAITING status with waitStartedAt", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const result = await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        arrivedAt,
        checkedInBy: "receptionist-1",
      });
      expect(result.status).toBe("WAITING");
      const callData = (mockedPrisma.patientCheckIn.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.status).toBe("WAITING");
      expect(callData.waitStartedAt).toBeInstanceOf(Date);
    });

    it("defaults triagePriority to NON_URGENT", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        arrivedAt,
      });
      const callData = (mockedPrisma.patientCheckIn.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.triagePriority).toBe("NON_URGENT");
    });
  });

  describe("get", () => {
    it("returns check-in when found", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const result = await PatientCheckInService.get("checkin-1", "org-1");
      expect(result.id).toBe("checkin-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        PatientCheckInService.get("checkin-x", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("list", () => {
    it("lists all check-ins for organisation", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([
        baseCheckIn,
      ]);
      const result = await PatientCheckInService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by status", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([]);
      await PatientCheckInService.list({
        organisationId: "org-1",
        status: "WAITING",
      });
      const where = (mockedPrisma.patientCheckIn.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.status).toBe("WAITING");
    });

    it("applies date filter as date range", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([]);
      await PatientCheckInService.list({
        organisationId: "org-1",
        date: new Date("2026-06-30"),
      });
      const where = (mockedPrisma.patientCheckIn.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.arrivedAt).toBeDefined();
    });
  });

  describe("markSeen", () => {
    it("transitions to IN_CONSULTATION and computes waitMinutes", async () => {
      const waitStartedAt = new Date(Date.now() - 20 * 60 * 1000);
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        waitStartedAt,
      });
      const seen = {
        ...baseCheckIn,
        status: "IN_CONSULTATION" as const,
        seenAt: new Date(),
        waitMinutes: 20,
      };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(seen);
      const result = await PatientCheckInService.markSeen("checkin-1", "org-1");
      expect(result.status).toBe("IN_CONSULTATION");
    });

    it("throws 409 for terminal COMPLETED status", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "COMPLETED",
      });
      await expect(
        PatientCheckInService.markSeen("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("complete", () => {
    it("completes a WAITING check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const completed = { ...baseCheckIn, status: "COMPLETED" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        completed,
      );
      const result = await PatientCheckInService.complete("checkin-1", "org-1");
      expect(result.status).toBe("COMPLETED");
    });

    it("throws 409 if already completed", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "COMPLETED",
      });
      await expect(
        PatientCheckInService.complete("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("cancel", () => {
    it("cancels a WAITING check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const cancelled = { ...baseCheckIn, status: "CANCELLED" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        cancelled,
      );
      const result = await PatientCheckInService.cancel("checkin-1", "org-1");
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("markNoShow", () => {
    it("marks a WAITING check-in as NO_SHOW", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const noShow = { ...baseCheckIn, status: "NO_SHOW" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        noShow,
      );
      const result = await PatientCheckInService.markNoShow(
        "checkin-1",
        "org-1",
      );
      expect(result.status).toBe("NO_SHOW");
    });

    it("throws 409 for terminal NO_SHOW status", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "NO_SHOW",
      });
      await expect(
        PatientCheckInService.markNoShow("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("assignRoom", () => {
    it("assigns a room to a waiting check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const withRoom = { ...baseCheckIn, assignedRoomId: "room-3" };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        withRoom,
      );
      const result = await PatientCheckInService.assignRoom(
        "checkin-1",
        "org-1",
        "room-3",
      );
      expect(result.assignedRoomId).toBe("room-3");
    });
  });
});
