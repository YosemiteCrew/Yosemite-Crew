import { PreOpAssessmentService } from "../../src/services/pre-op-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    preOpAssessment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.preOpAssessment.create as jest.Mock;
const mockFindFirst = prisma.preOpAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.preOpAssessment.findMany as jest.Mock;
const mockUpdate = prisma.preOpAssessment.update as jest.Mock;
const mockDelete = prisma.preOpAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "poa-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  asaClass: "ASA_II" as const,
  fastingStartedAt: new Date("2026-06-30T06:00:00Z"),
  labsReviewed: true,
  ecgReviewed: false,
  ownerConsentSigned: true,
  anesthetistId: "vet-2",
  surgeonId: "vet-1",
  plannedProcedure: "Ovariohysterectomy",
  anesthesiaType: "TIVA",
  knownAllergies: null,
  currentMedications: "Meloxicam 0.1mg/kg",
  airwayNotes: null,
  cardiovascularNotes: null,
  notes: null,
  assessedBy: "vet-2",
  assessedAt: new Date("2026-06-30T07:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("PreOpAssessmentService.create", () => {
  it("creates an ASA II pre-op assessment", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await PreOpAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      asaClass: "ASA_II",
      labsReviewed: true,
      ownerConsentSigned: true,
      plannedProcedure: "Ovariohysterectomy",
      assessedBy: "vet-2",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: "enc-1",
          asaClass: "ASA_II",
          labsReviewed: true,
        }),
      }),
    );
    expect(result.asaClass).toBe("ASA_II");
    expect(result.ownerConsentSigned).toBe(true);
  });
});

describe("PreOpAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await PreOpAssessmentService.get("poa-1", "org-1");
    expect(result.id).toBe("poa-1");
    expect(result.plannedProcedure).toBe("Ovariohysterectomy");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PreOpAssessmentService.get("poa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("PreOpAssessmentService.list", () => {
  it("filters by encounterId", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await PreOpAssessmentService.list({
      organisationId: "org-1",
      encounterId: "enc-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encounterId: "enc-1" }),
      }),
    );
  });

  it("filters by asaClass", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await PreOpAssessmentService.list({
      organisationId: "org-1",
      asaClass: "ASA_II",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ asaClass: "ASA_II" }),
      }),
    );
  });
});

describe("PreOpAssessmentService.update", () => {
  it("marks consent as signed", async () => {
    const updated = { ...baseAssessment, ownerConsentSigned: true };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await PreOpAssessmentService.update("poa-1", "org-1", {
      ownerConsentSigned: true,
    });
    expect(result.ownerConsentSigned).toBe(true);
  });

  it("upgrades ASA class to IV", async () => {
    const updated = { ...baseAssessment, asaClass: "ASA_IV" as const };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await PreOpAssessmentService.update("poa-1", "org-1", {
      asaClass: "ASA_IV",
    });
    expect(result.asaClass).toBe("ASA_IV");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PreOpAssessmentService.update("poa-x", "org-1", { labsReviewed: true }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PreOpAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await PreOpAssessmentService.delete("poa-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "poa-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PreOpAssessmentService.delete("poa-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
