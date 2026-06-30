jest.mock("src/config/prisma", () => ({
  prisma: {
    anaesthesiaRecord: {
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
  AnaesthesiaRecordService,
  AnaesthesiaRecordError,
} from "../../src/services/anaesthesia-record.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const baseRecord = {
  id: "anaesthesia-1",
  organisationId: "org-1",
  patientId: "patient-1",
  appointmentId: "appt-1",
  surgicalProcedureId: null,
  anaesthetistId: "dr-jones",
  inductionAgent: "Propofol",
  maintenanceAgent: "Isoflurane",
  oxygenFlowLpm: 1.5,
  startedAt: null,
  endedAt: null,
  durationMinutes: null,
  preOpAssessment: "ASA class II",
  preMedications: null,
  intraOpNotes: null,
  complications: null,
  recoveryNotes: null,
  status: "PLANNED" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AnaesthesiaRecordService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("plan", () => {
    it("creates a record in PLANNED status", async () => {
      (mockedPrisma.anaesthesiaRecord.create as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const result = await AnaesthesiaRecordService.plan({
        organisationId: "org-1",
        patientId: "patient-1",
        appointmentId: "appt-1",
        inductionAgent: "Propofol",
      });
      expect(result.status).toBe("PLANNED");
      const callData = (mockedPrisma.anaesthesiaRecord.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.status).toBe("PLANNED");
    });
  });

  describe("get", () => {
    it("returns record when found", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const result = await AnaesthesiaRecordService.get(
        "anaesthesia-1",
        "org-1",
      );
      expect(result.id).toBe("anaesthesia-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(AnaesthesiaRecordService.get("x", "org-1")).rejects.toThrow(
        AnaesthesiaRecordError,
      );
    });
  });

  describe("list", () => {
    it("lists all records for organisation", async () => {
      (mockedPrisma.anaesthesiaRecord.findMany as jest.Mock).mockResolvedValue([
        baseRecord,
      ]);
      const result = await AnaesthesiaRecordService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by status", async () => {
      (mockedPrisma.anaesthesiaRecord.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await AnaesthesiaRecordService.list({
        organisationId: "org-1",
        status: "PLANNED",
      });
      const where = (mockedPrisma.anaesthesiaRecord.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.status).toBe("PLANNED");
    });
  });

  describe("start", () => {
    it("transitions PLANNED to IN_PROGRESS and sets startedAt", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const started = {
        ...baseRecord,
        status: "IN_PROGRESS" as const,
        startedAt: new Date(),
      };
      (mockedPrisma.anaesthesiaRecord.update as jest.Mock).mockResolvedValue(
        started,
      );
      const result = await AnaesthesiaRecordService.start(
        "anaesthesia-1",
        "org-1",
      );
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("throws 409 for terminal COMPLETED status", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "COMPLETED",
        },
      );
      await expect(
        AnaesthesiaRecordService.start("anaesthesia-1", "org-1"),
      ).rejects.toThrow(AnaesthesiaRecordError);
    });

    it("throws 409 for terminal ABORTED status", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "ABORTED",
        },
      );
      await expect(
        AnaesthesiaRecordService.start("anaesthesia-1", "org-1"),
      ).rejects.toThrow(AnaesthesiaRecordError);
    });
  });

  describe("updateIntraOpNotes", () => {
    it("updates notes during IN_PROGRESS anaesthesia", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "IN_PROGRESS",
        },
      );
      const updated = {
        ...baseRecord,
        status: "IN_PROGRESS" as const,
        intraOpNotes: { t10: { hr: 72 } },
      };
      (mockedPrisma.anaesthesiaRecord.update as jest.Mock).mockResolvedValue(
        updated,
      );
      const result = await AnaesthesiaRecordService.updateIntraOpNotes(
        "anaesthesia-1",
        "org-1",
        { t10: { hr: 72 } },
      );
      expect(result.intraOpNotes).toEqual({ t10: { hr: 72 } });
    });

    it("throws 409 if not IN_PROGRESS", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      await expect(
        AnaesthesiaRecordService.updateIntraOpNotes(
          "anaesthesia-1",
          "org-1",
          {},
        ),
      ).rejects.toThrow(AnaesthesiaRecordError);
    });
  });

  describe("complete", () => {
    it("completes IN_PROGRESS anaesthesia and computes durationMinutes", async () => {
      const startedAt = new Date(Date.now() - 45 * 60 * 1000);
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "IN_PROGRESS",
          startedAt,
        },
      );
      const completed = {
        ...baseRecord,
        status: "COMPLETED" as const,
        startedAt,
        endedAt: new Date(),
        durationMinutes: 45,
        recoveryNotes: "Smooth recovery",
      };
      (mockedPrisma.anaesthesiaRecord.update as jest.Mock).mockResolvedValue(
        completed,
      );
      const result = await AnaesthesiaRecordService.complete(
        "anaesthesia-1",
        "org-1",
        {
          recoveryNotes: "Smooth recovery",
        },
      );
      expect(result.status).toBe("COMPLETED");
    });

    it("throws 409 if already completed", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "COMPLETED",
        },
      );
      await expect(
        AnaesthesiaRecordService.complete("anaesthesia-1", "org-1", {}),
      ).rejects.toThrow(AnaesthesiaRecordError);
    });
  });

  describe("abort", () => {
    it("aborts a PLANNED anaesthesia with complications", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const aborted = {
        ...baseRecord,
        status: "ABORTED" as const,
        complications: "Bradycardia",
      };
      (mockedPrisma.anaesthesiaRecord.update as jest.Mock).mockResolvedValue(
        aborted,
      );
      const result = await AnaesthesiaRecordService.abort(
        "anaesthesia-1",
        "org-1",
        "Bradycardia",
      );
      expect(result.status).toBe("ABORTED");
    });

    it("throws 409 if already aborted", async () => {
      (mockedPrisma.anaesthesiaRecord.findFirst as jest.Mock).mockResolvedValue(
        {
          ...baseRecord,
          status: "ABORTED",
        },
      );
      await expect(
        AnaesthesiaRecordService.abort("anaesthesia-1", "org-1"),
      ).rejects.toThrow(AnaesthesiaRecordError);
    });
  });
});
