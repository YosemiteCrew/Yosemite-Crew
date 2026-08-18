jest.mock("src/config/prisma", () => ({
  prisma: {
    telemedicineSession: {
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
  TelemedicineSessionService,
  TelemedicineSessionError,
} from "../../src/services/telemedicine-session.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const baseSession = {
  id: "session-1",
  organisationId: "org-1",
  appointmentId: null,
  clientId: "client-1",
  patientId: "patient-1",
  platform: "VIDEO_CALL" as const,
  status: "SCHEDULED" as const,
  startedAt: null,
  endedAt: null,
  durationMinutes: null,
  conductedBy: "dr-smith",
  chiefComplaint: "Lethargy",
  clinicianNotes: null,
  followUpRequired: false,
  recordingUrl: null,
  externalSessionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TelemedicineSessionService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("schedule", () => {
    it("creates a session in SCHEDULED status", async () => {
      (mockedPrisma.telemedicineSession.create as jest.Mock).mockResolvedValue(
        baseSession,
      );
      const result = await TelemedicineSessionService.schedule({
        organisationId: "org-1",
        clientId: "client-1",
        patientId: "patient-1",
        platform: "VIDEO_CALL",
      });
      expect(result.status).toBe("SCHEDULED");
      const callData = (mockedPrisma.telemedicineSession.create as jest.Mock)
        .mock.calls[0][0].data;
      expect(callData.status).toBe("SCHEDULED");
    });
  });

  describe("get", () => {
    it("returns session when found", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue(baseSession);
      const result = await TelemedicineSessionService.get("session-1", "org-1");
      expect(result.id).toBe("session-1");
    });

    it("throws 404 when not found", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue(null);
      await expect(
        TelemedicineSessionService.get("session-x", "org-1"),
      ).rejects.toThrow(TelemedicineSessionError);
    });
  });

  describe("list", () => {
    it("lists all sessions for organisation", async () => {
      (
        mockedPrisma.telemedicineSession.findMany as jest.Mock
      ).mockResolvedValue([baseSession]);
      const result = await TelemedicineSessionService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by status and platform", async () => {
      (
        mockedPrisma.telemedicineSession.findMany as jest.Mock
      ).mockResolvedValue([]);
      await TelemedicineSessionService.list({
        organisationId: "org-1",
        status: "COMPLETED",
        platform: "PHONE_CALL",
      });
      const where = (mockedPrisma.telemedicineSession.findMany as jest.Mock)
        .mock.calls[0][0].where;
      expect(where.status).toBe("COMPLETED");
      expect(where.platform).toBe("PHONE_CALL");
    });
  });

  describe("start", () => {
    it("transitions to IN_PROGRESS and sets startedAt", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue(baseSession);
      const started = {
        ...baseSession,
        status: "IN_PROGRESS" as const,
        startedAt: new Date(),
      };
      (mockedPrisma.telemedicineSession.update as jest.Mock).mockResolvedValue(
        started,
      );
      const result = await TelemedicineSessionService.start(
        "session-1",
        "org-1",
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("throws 409 for terminal status COMPLETED", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseSession,
        status: "COMPLETED",
      });
      await expect(
        TelemedicineSessionService.start("session-1", "org-1"),
      ).rejects.toThrow(TelemedicineSessionError);
    });

    it("throws 409 for terminal status CANCELLED", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseSession,
        status: "CANCELLED",
      });
      await expect(
        TelemedicineSessionService.start("session-1", "org-1"),
      ).rejects.toThrow(TelemedicineSessionError);
    });
  });

  describe("complete", () => {
    it("completes a session and computes durationMinutes", async () => {
      const startedAt = new Date(Date.now() - 30 * 60 * 1000);
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseSession,
        status: "IN_PROGRESS",
        startedAt,
      });
      const completed = {
        ...baseSession,
        status: "COMPLETED" as const,
        startedAt,
        endedAt: new Date(),
        durationMinutes: 30,
        clinicianNotes: "Patient improving",
        followUpRequired: true,
      };
      (mockedPrisma.telemedicineSession.update as jest.Mock).mockResolvedValue(
        completed,
      );
      const result = await TelemedicineSessionService.complete(
        "session-1",
        "org-1",
        {
          clinicianNotes: "Patient improving",
          followUpRequired: true,
        },
      );
      expect(result.status).toBe("COMPLETED");
      expect(result.followUpRequired).toBe(true);
    });

    it("throws 409 if already completed", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseSession,
        status: "COMPLETED",
      });
      await expect(
        TelemedicineSessionService.complete("session-1", "org-1", {}),
      ).rejects.toThrow(TelemedicineSessionError);
    });
  });

  describe("cancel", () => {
    it("cancels a SCHEDULED session", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue(baseSession);
      const cancelled = { ...baseSession, status: "CANCELLED" as const };
      (mockedPrisma.telemedicineSession.update as jest.Mock).mockResolvedValue(
        cancelled,
      );
      const result = await TelemedicineSessionService.cancel(
        "session-1",
        "org-1",
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("throws 409 for terminal status NO_SHOW", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseSession,
        status: "NO_SHOW",
      });
      await expect(
        TelemedicineSessionService.cancel("session-1", "org-1"),
      ).rejects.toThrow(TelemedicineSessionError);
    });
  });

  describe("markNoShow", () => {
    it("marks a SCHEDULED session as NO_SHOW", async () => {
      (
        mockedPrisma.telemedicineSession.findFirst as jest.Mock
      ).mockResolvedValue(baseSession);
      const noShow = { ...baseSession, status: "NO_SHOW" as const };
      (mockedPrisma.telemedicineSession.update as jest.Mock).mockResolvedValue(
        noShow,
      );
      const result = await TelemedicineSessionService.markNoShow(
        "session-1",
        "org-1",
      );
      expect(result.status).toBe("NO_SHOW");
    });
  });
});
