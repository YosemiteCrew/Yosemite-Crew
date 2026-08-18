import { NeurologyAssessmentService } from "../../src/services/neurology-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    neurologyAssessment: {
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

const mockCreate = prisma.neurologyAssessment.create as jest.Mock;
const mockFindFirst = prisma.neurologyAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.neurologyAssessment.findMany as jest.Mock;
const mockUpdate = prisma.neurologyAssessment.update as jest.Mock;
const mockDelete = prisma.neurologyAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "na-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  consciousnessLevel: "ALERT" as const,
  gaitScore: "ATAXIC" as const,
  cranialNerveFindings: "CN II-XII intact",
  spinalReflexGrades: { patellar: "NORMAL", withdrawal: "EXAGGERATED" },
  deepPainPresent: true,
  proprioceptionIntact: false,
  seizureHistory: true,
  seizureFrequency: "Monthly",
  mriRecommended: true,
  diagnoses: ["Degenerative myelopathy"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("NeurologyAssessmentService.create", () => {
  it("creates an assessment with consciousness and gait", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await NeurologyAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      consciousnessLevel: "ALERT",
      gaitScore: "ATAXIC",
      spinalReflexGrades: { patellar: "NORMAL" },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consciousnessLevel: "ALERT",
          gaitScore: "ATAXIC",
        }),
      }),
    );
    expect(result.consciousnessLevel).toBe("ALERT");
  });
});

describe("NeurologyAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await NeurologyAssessmentService.get("na-1", "org-1");
    expect(result.id).toBe("na-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NeurologyAssessmentService.get("na-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("NeurologyAssessmentService.list", () => {
  it("filters by gait score", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await NeurologyAssessmentService.list({
      organisationId: "org-1",
      gaitScore: "ATAXIC",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gaitScore: "ATAXIC" }),
      }),
    );
  });
});

describe("NeurologyAssessmentService.update", () => {
  it("updates MRI recommendation and seizure data", async () => {
    const updated = {
      ...baseAssessment,
      mriRecommended: false,
      seizureHistory: false,
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await NeurologyAssessmentService.update("na-1", "org-1", {
      mriRecommended: false,
      seizureHistory: false,
    });
    expect(result.mriRecommended).toBe(false);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NeurologyAssessmentService.update("na-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("NeurologyAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await NeurologyAssessmentService.delete("na-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "na-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NeurologyAssessmentService.delete("na-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
