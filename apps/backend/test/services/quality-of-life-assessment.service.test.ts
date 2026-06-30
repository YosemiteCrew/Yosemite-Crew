import { QualityOfLifeAssessmentService } from "../../src/services/quality-of-life-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    qualityOfLifeAssessment: {
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

const mockCreate = prisma.qualityOfLifeAssessment.create as jest.Mock;
const mockFindFirst = prisma.qualityOfLifeAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.qualityOfLifeAssessment.findMany as jest.Mock;
const mockUpdate = prisma.qualityOfLifeAssessment.update as jest.Mock;

const baseAssessment = {
  id: "qol-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  assessedAt: new Date("2026-06-30"),
  assessedBy: "Dr Patel",
  hhhhhmmScore: 30,
  painScore: 4,
  appetiteScore: 7,
  hygieneScore: 8,
  happinessScore: 6,
  mobilityScore: 5,
  moreDaysGood: true,
  overallScore: 6,
  ownerAssessed: false,
  clinicianNotes: "Stable chronic pain management. Monitor appetite.",
  ownerNotes: null,
  euthanasiaDiscussed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("QualityOfLifeAssessmentService.create", () => {
  it("creates a QOL assessment with scores", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await QualityOfLifeAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30"),
      overallScore: 6,
      euthanasiaDiscussed: false,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: "pat-1",
          ownerAssessed: false,
        }),
      }),
    );
    expect(result.overallScore).toBe(6);
  });
});

describe("QualityOfLifeAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await QualityOfLifeAssessmentService.get("qol-1", "org-1");
    expect(result.id).toBe("qol-1");
    expect(result.euthanasiaDiscussed).toBe(false);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      QualityOfLifeAssessmentService.get("qol-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("QualityOfLifeAssessmentService.list", () => {
  it("filters by patientId", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await QualityOfLifeAssessmentService.list({
      organisationId: "org-1",
      patientId: "pat-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });
});

describe("QualityOfLifeAssessmentService.trend", () => {
  it("returns records ordered ASC for charting with default limit 20", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await QualityOfLifeAssessmentService.trend("pat-1", "org-1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
        orderBy: { assessedAt: "asc" },
        take: 20,
      }),
    );
  });
});

describe("QualityOfLifeAssessmentService.update", () => {
  it("updates clinician notes and flags euthanasia discussed", async () => {
    const updated = {
      ...baseAssessment,
      clinicianNotes: "Declining QOL. Euthanasia discussed with owner.",
      euthanasiaDiscussed: true,
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await QualityOfLifeAssessmentService.update(
      "qol-1",
      "org-1",
      {
        clinicianNotes: "Declining QOL. Euthanasia discussed with owner.",
        euthanasiaDiscussed: true,
      },
    );
    expect(result.euthanasiaDiscussed).toBe(true);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      QualityOfLifeAssessmentService.update("qol-x", "org-1", {
        overallScore: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
