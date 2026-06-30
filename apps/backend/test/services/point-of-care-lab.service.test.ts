jest.mock("src/config/prisma", () => ({
  prisma: {
    pointOfCareLab: {
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
  PointOfCareLabService,
  PointOfCareLabError,
} from "../../src/services/point-of-care-lab.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const baseRecord = {
  id: "lab-1",
  organisationId: "org-1",
  patientId: "patient-1",
  encounterId: null,
  conductedAt: new Date("2026-06-30T10:00:00Z"),
  conductedBy: "dr-smith",
  testType: "CBC" as const,
  analyzerName: "IDEXX Pro",
  sampleType: "BLOOD",
  results: { wbc: 5.5, rbc: 8.0 },
  overallInterpretation: "Within normal limits",
  abnormalFlags: [],
  criticalFlags: [],
  followUpRecommended: false,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PointOfCareLabService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("creates a POC lab record and emits audit event", async () => {
      (mockedPrisma.pointOfCareLab.create as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const result = await PointOfCareLabService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        conductedAt: new Date("2026-06-30T10:00:00Z"),
        testType: "CBC",
        results: { wbc: 5.5 },
      });
      expect(result.id).toBe("lab-1");
      expect(mockedPrisma.pointOfCareLab.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ testType: "CBC" }),
        }),
      );
    });

    it("casts results as Prisma.InputJsonValue", async () => {
      (mockedPrisma.pointOfCareLab.create as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      await PointOfCareLabService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        conductedAt: new Date(),
        testType: "URINALYSIS",
        results: { glucose: "negative", protein: "trace" },
      });
      const callArg = (mockedPrisma.pointOfCareLab.create as jest.Mock).mock
        .calls[0][0];
      expect(callArg.data.results).toEqual({
        glucose: "negative",
        protein: "trace",
      });
    });
  });

  describe("get", () => {
    it("returns record when found", async () => {
      (mockedPrisma.pointOfCareLab.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const result = await PointOfCareLabService.get("lab-1", "org-1");
      expect(result.id).toBe("lab-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.pointOfCareLab.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(PointOfCareLabService.get("lab-x", "org-1")).rejects.toThrow(
        PointOfCareLabError,
      );
    });
  });

  describe("list", () => {
    it("lists all records for organisation", async () => {
      (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mockResolvedValue([
        baseRecord,
      ]);
      const result = await PointOfCareLabService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by testType", async () => {
      (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mockResolvedValue([]);
      await PointOfCareLabService.list({
        organisationId: "org-1",
        testType: "BLOOD_CHEMISTRY",
      });
      const where = (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.testType).toBe("BLOOD_CHEMISTRY");
    });

    it("filters hasCriticalFlags=true", async () => {
      (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mockResolvedValue([]);
      await PointOfCareLabService.list({
        organisationId: "org-1",
        hasCriticalFlags: true,
      });
      const where = (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.criticalFlags).toEqual({ isEmpty: false });
    });

    it("filters hasCriticalFlags=false", async () => {
      (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mockResolvedValue([]);
      await PointOfCareLabService.list({
        organisationId: "org-1",
        hasCriticalFlags: false,
      });
      const where = (mockedPrisma.pointOfCareLab.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.criticalFlags).toEqual({ isEmpty: true });
    });
  });

  describe("update", () => {
    it("updates interpretation and notes", async () => {
      (mockedPrisma.pointOfCareLab.findFirst as jest.Mock).mockResolvedValue(
        baseRecord,
      );
      const updated = {
        ...baseRecord,
        overallInterpretation: "Mild anaemia",
        notes: "Recheck in 2 weeks",
      };
      (mockedPrisma.pointOfCareLab.update as jest.Mock).mockResolvedValue(
        updated,
      );
      const result = await PointOfCareLabService.update("lab-1", "org-1", {
        overallInterpretation: "Mild anaemia",
        notes: "Recheck in 2 weeks",
      });
      expect(result.overallInterpretation).toBe("Mild anaemia");
    });

    it("throws 404 when record not found", async () => {
      (mockedPrisma.pointOfCareLab.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        PointOfCareLabService.update("lab-x", "org-1", {}),
      ).rejects.toThrow(PointOfCareLabError);
    });
  });
});
