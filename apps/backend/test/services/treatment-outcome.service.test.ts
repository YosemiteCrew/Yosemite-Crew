jest.mock("src/config/prisma", () => ({
  prisma: {
    treatmentOutcome: {
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
  TreatmentOutcomeService,
  TreatmentOutcomeError,
} from "../../src/services/treatment-outcome.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const recordedAt = new Date("2026-07-01T10:00:00Z");
const baseOutcome = {
  id: "outcome-1",
  organisationId: "org-1",
  patientId: "patient-1",
  encounterId: "encounter-1",
  episodeOfCareId: null,
  recordedAt,
  recordedBy: "vet-1",
  outcomeType: "IMPROVED" as const,
  clinicalNotes: "Patient showing improvement",
  followUpDate: null,
  followUpNotes: null,
  resolved: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TreatmentOutcomeService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("record", () => {
    it("creates an outcome record", async () => {
      (mockedPrisma.treatmentOutcome.create as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      const result = await TreatmentOutcomeService.record({
        organisationId: "org-1",
        patientId: "patient-1",
        recordedAt,
        recordedBy: "vet-1",
        outcomeType: "IMPROVED",
        clinicalNotes: "Patient showing improvement",
      });
      expect(result.outcomeType).toBe("IMPROVED");
    });

    it("auto-resolves when outcomeType is RECOVERED", async () => {
      const recovered = {
        ...baseOutcome,
        outcomeType: "RECOVERED" as const,
        resolved: true,
      };
      (mockedPrisma.treatmentOutcome.create as jest.Mock).mockResolvedValue(
        recovered,
      );
      await TreatmentOutcomeService.record({
        organisationId: "org-1",
        patientId: "patient-1",
        recordedAt,
        outcomeType: "RECOVERED",
      });
      const data = (mockedPrisma.treatmentOutcome.create as jest.Mock).mock
        .calls[0][0].data;
      expect(data.resolved).toBe(true);
    });

    it("does not auto-resolve for IMPROVED", async () => {
      (mockedPrisma.treatmentOutcome.create as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      await TreatmentOutcomeService.record({
        organisationId: "org-1",
        patientId: "patient-1",
        recordedAt,
        outcomeType: "IMPROVED",
      });
      const data = (mockedPrisma.treatmentOutcome.create as jest.Mock).mock
        .calls[0][0].data;
      expect(data.resolved).toBe(false);
    });
  });

  describe("get", () => {
    it("returns outcome when found", async () => {
      (mockedPrisma.treatmentOutcome.findFirst as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      const result = await TreatmentOutcomeService.get("outcome-1", "org-1");
      expect(result.id).toBe("outcome-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.treatmentOutcome.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(TreatmentOutcomeService.get("x", "org-1")).rejects.toThrow(
        TreatmentOutcomeError,
      );
    });
  });

  describe("list", () => {
    it("lists all outcomes for organisation", async () => {
      (mockedPrisma.treatmentOutcome.findMany as jest.Mock).mockResolvedValue([
        baseOutcome,
      ]);
      const result = await TreatmentOutcomeService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by patientId and outcomeType", async () => {
      (mockedPrisma.treatmentOutcome.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await TreatmentOutcomeService.list({
        organisationId: "org-1",
        patientId: "patient-1",
        outcomeType: "IMPROVED",
      });
      const where = (mockedPrisma.treatmentOutcome.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.patientId).toBe("patient-1");
      expect(where.outcomeType).toBe("IMPROVED");
    });

    it("filters by resolved flag", async () => {
      (mockedPrisma.treatmentOutcome.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await TreatmentOutcomeService.list({
        organisationId: "org-1",
        resolved: false,
      });
      const where = (mockedPrisma.treatmentOutcome.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.resolved).toBe(false);
    });
  });

  describe("update", () => {
    it("updates clinical notes", async () => {
      (mockedPrisma.treatmentOutcome.findFirst as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      const updated = { ...baseOutcome, clinicalNotes: "Better notes" };
      (mockedPrisma.treatmentOutcome.update as jest.Mock).mockResolvedValue(
        updated,
      );
      const result = await TreatmentOutcomeService.update(
        "outcome-1",
        "org-1",
        {
          clinicalNotes: "Better notes",
        },
      );
      expect(result.clinicalNotes).toBe("Better notes");
    });

    it("auto-resolves when outcomeType changed to RECOVERED", async () => {
      (mockedPrisma.treatmentOutcome.findFirst as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      const recovered = {
        ...baseOutcome,
        outcomeType: "RECOVERED" as const,
        resolved: true,
      };
      (mockedPrisma.treatmentOutcome.update as jest.Mock).mockResolvedValue(
        recovered,
      );
      await TreatmentOutcomeService.update("outcome-1", "org-1", {
        outcomeType: "RECOVERED",
      });
      const data = (mockedPrisma.treatmentOutcome.update as jest.Mock).mock
        .calls[0][0].data;
      expect(data.resolved).toBe(true);
    });
  });

  describe("resolve", () => {
    it("marks an outcome as resolved", async () => {
      (mockedPrisma.treatmentOutcome.findFirst as jest.Mock).mockResolvedValue(
        baseOutcome,
      );
      const resolved = { ...baseOutcome, resolved: true };
      (mockedPrisma.treatmentOutcome.update as jest.Mock).mockResolvedValue(
        resolved,
      );
      const result = await TreatmentOutcomeService.resolve(
        "outcome-1",
        "org-1",
      );
      expect(result.resolved).toBe(true);
    });
  });
});
