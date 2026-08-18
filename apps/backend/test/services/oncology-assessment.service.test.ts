import { OncologyAssessmentService } from "../../src/services/oncology-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    oncologyAssessment: {
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

const mockCreate = prisma.oncologyAssessment.create as jest.Mock;
const mockFindFirst = prisma.oncologyAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.oncologyAssessment.findMany as jest.Mock;
const mockUpdate = prisma.oncologyAssessment.update as jest.Mock;
const mockDelete = prisma.oncologyAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "oa-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  tumorType: "Mast cell tumor",
  primaryTumorStage: "T2",
  nodeStage: "N0",
  metastasisStage: "M0",
  overallStage: "STAGE_II" as const,
  chemotherapyProtocol: "CHOP",
  chemotherapyStartDate: new Date("2026-07-01T00:00:00Z"),
  chemotherapyCycles: 6,
  qualityOfLifeScore: 7,
  prognosis: "Guarded",
  diagnoses: ["Canine mast cell tumor grade II"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("OncologyAssessmentService.create", () => {
  it("creates assessment with TNM staging", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await OncologyAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      tumorType: "Mast cell tumor",
      overallStage: "STAGE_II",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tumorType: "Mast cell tumor",
          overallStage: "STAGE_II",
        }),
      }),
    );
    expect(result.overallStage).toBe("STAGE_II");
  });
});

describe("OncologyAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await OncologyAssessmentService.get("oa-1", "org-1");
    expect(result.id).toBe("oa-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OncologyAssessmentService.get("oa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("OncologyAssessmentService.list", () => {
  it("filters by overall stage", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await OncologyAssessmentService.list({
      organisationId: "org-1",
      overallStage: "STAGE_II",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ overallStage: "STAGE_II" }),
      }),
    );
  });
});

describe("OncologyAssessmentService.update", () => {
  it("updates QoL score and chemo cycles", async () => {
    const updated = {
      ...baseAssessment,
      qualityOfLifeScore: 5,
      chemotherapyCycles: 8,
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await OncologyAssessmentService.update("oa-1", "org-1", {
      qualityOfLifeScore: 5,
      chemotherapyCycles: 8,
    });
    expect(result.qualityOfLifeScore).toBe(5);
    expect(result.chemotherapyCycles).toBe(8);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OncologyAssessmentService.update("oa-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("OncologyAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await OncologyAssessmentService.delete("oa-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "oa-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      OncologyAssessmentService.delete("oa-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
