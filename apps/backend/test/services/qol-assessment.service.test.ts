import { QolAssessmentService } from "../../src/services/qol-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    qualityOfLifeAssessment: {
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

const mockCreate = prisma.qualityOfLifeAssessment.create as jest.Mock;
const mockFindFirst = prisma.qualityOfLifeAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.qualityOfLifeAssessment.findMany as jest.Mock;
const mockUpdate = prisma.qualityOfLifeAssessment.update as jest.Mock;
const mockDelete = prisma.qualityOfLifeAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "qol-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  hhhhhmmScore: 42,
  painScore: 6,
  appetiteScore: 5,
  hygieneScore: 7,
  happinessScore: 5,
  mobilityScore: 4,
  moreDaysGood: false,
  overallScore: 45,
  ownerAssessed: false,
  clinicianNotes: "Significant decline from last month",
  ownerNotes: null,
  euthanasiaDiscussed: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: the companion belongs to the caller's organisation, so every

  // pre-existing case keeps its original meaning. Cross-tenant is asserted

  // explicitly in its own test below.

  (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
    id: "patient-org-1",
  });
});

describe("QolAssessmentService.create", () => {
  it("creates a QoL assessment with HHHHHMM score", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await QolAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      hhhhhmmScore: 42,
      overallScore: 45,
      euthanasiaDiscussed: true,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hhhhhmmScore: 42,
          euthanasiaDiscussed: true,
        }),
      }),
    );
    expect(result.hhhhhmmScore).toBe(42);
  });
});

describe("QolAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await QolAssessmentService.get("qol-1", "org-1");
    expect(result.id).toBe("qol-1");
    expect(result.euthanasiaDiscussed).toBe(true);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      QolAssessmentService.get("qol-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("QolAssessmentService.list", () => {
  it("filters by owner-assessed flag", async () => {
    mockFindMany.mockResolvedValue([
      { ...baseAssessment, ownerAssessed: true },
    ]);
    await QolAssessmentService.list({
      organisationId: "org-1",
      ownerAssessed: true,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerAssessed: true }),
      }),
    );
  });
});

describe("QolAssessmentService.update", () => {
  it("updates scores after recheck", async () => {
    const updated = { ...baseAssessment, hhhhhmmScore: 35, overallScore: 38 };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await QolAssessmentService.update("qol-1", "org-1", {
      hhhhhmmScore: 35,
      overallScore: 38,
    });
    expect(result.hhhhhmmScore).toBe(35);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      QolAssessmentService.update("qol-x", "org-1", { ownerNotes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("QolAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await QolAssessmentService.delete("qol-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "qol-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      QolAssessmentService.delete("qol-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("QolAssessmentService cross-tenant protection", () => {
  it("refuses to write against a companion in another organisation", async () => {
    // The caller is a legitimate member of org-1; the companion is not.
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      QolAssessmentService.create({
        organisationId: "org-1",
        patientId: "pat-1",
        assessedAt: new Date("2026-06-30T10:00:00Z"),
        hhhhhmmScore: 42,
        overallScore: 45,
        euthanasiaDiscussed: true,
      }),
    ).rejects.toThrow("Companion not found.");

    // Rejecting is not enough - nothing may be persisted on the way out.
    expect(
      prisma.qualityOfLifeAssessment.create as jest.Mock,
    ).not.toHaveBeenCalled();
  });
});
