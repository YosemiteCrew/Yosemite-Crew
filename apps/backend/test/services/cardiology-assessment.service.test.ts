import { CardiologyAssessmentService } from "../../src/services/cardiology-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    cardiologyAssessment: {
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

const mockCreate = prisma.cardiologyAssessment.create as jest.Mock;
const mockFindFirst = prisma.cardiologyAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.cardiologyAssessment.findMany as jest.Mock;
const mockUpdate = prisma.cardiologyAssessment.update as jest.Mock;
const mockDelete = prisma.cardiologyAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "ca-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  heartRate: 90,
  heartRhythm: "NORMAL_SINUS" as const,
  murmurGrade: "GRADE_3" as const,
  murmurLocation: "Left apex",
  murmurCharacter: "systolic",
  pulseQuality: "Strong and synchronous",
  jugularPulse: "Absent",
  vertebralHeartScore: "10.5",
  laAoRatio: "1.5",
  fractionalShortening: "32",
  ejectionFraction: "60",
  acvimClass: "B2" as const,
  findings: null,
  diagnoses: ["Myxomatous mitral valve disease"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("CardiologyAssessmentService.create", () => {
  it("creates an assessment with ACVIM class", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await CardiologyAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      heartRate: 90,
      murmurGrade: "GRADE_3",
      acvimClass: "B2",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          murmurGrade: "GRADE_3",
          acvimClass: "B2",
        }),
      }),
    );
    expect(result.acvimClass).toBe("B2");
  });
});

describe("CardiologyAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await CardiologyAssessmentService.get("ca-1", "org-1");
    expect(result.id).toBe("ca-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      CardiologyAssessmentService.get("ca-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("CardiologyAssessmentService.list", () => {
  it("filters by ACVIM class", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await CardiologyAssessmentService.list({
      organisationId: "org-1",
      acvimClass: "B2",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ acvimClass: "B2" }),
      }),
    );
  });
});

describe("CardiologyAssessmentService.update", () => {
  it("updates heart rate and rhythm", async () => {
    const updated = {
      ...baseAssessment,
      heartRate: 110,
      heartRhythm: "ATRIAL_FIBRILLATION" as const,
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await CardiologyAssessmentService.update("ca-1", "org-1", {
      heartRate: 110,
      heartRhythm: "ATRIAL_FIBRILLATION",
    });
    expect(result.heartRhythm).toBe("ATRIAL_FIBRILLATION");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      CardiologyAssessmentService.update("ca-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("CardiologyAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await CardiologyAssessmentService.delete("ca-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ca-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      CardiologyAssessmentService.delete("ca-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
