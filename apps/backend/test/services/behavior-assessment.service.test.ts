import { BehaviorAssessmentService } from "../../src/services/behavior-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    behaviorAssessment: {
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

const mockCreate = prisma.behaviorAssessment.create as jest.Mock;
const mockFindFirst = prisma.behaviorAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.behaviorAssessment.findMany as jest.Mock;
const mockUpdate = prisma.behaviorAssessment.update as jest.Mock;
const mockDelete = prisma.behaviorAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "ba-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  fasScore: "FAS_2" as const,
  nailTrimTolerance: "MODERATE" as const,
  handlingTolerance: "EASY" as const,
  aggressionTriggers: ["strangers"],
  aversionBehaviors: ["cowering"],
  trainingHistory: "Basic",
  diagnoses: ["Fear-based anxiety"],
  referralRecommended: true,
  fearFreeNotes: "Use high-value treats",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("BehaviorAssessmentService.create", () => {
  it("creates an assessment with FAS score", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await BehaviorAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      fasScore: "FAS_2",
      handlingTolerance: "EASY",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fasScore: "FAS_2" }),
      }),
    );
    expect(result.fasScore).toBe("FAS_2");
  });
});

describe("BehaviorAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await BehaviorAssessmentService.get("ba-1", "org-1");
    expect(result.id).toBe("ba-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BehaviorAssessmentService.get("ba-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("BehaviorAssessmentService.list", () => {
  it("filters by FAS score", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await BehaviorAssessmentService.list({
      organisationId: "org-1",
      fasScore: "FAS_2",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fasScore: "FAS_2" }),
      }),
    );
  });
});

describe("BehaviorAssessmentService.update", () => {
  it("updates FAS score", async () => {
    const updated = { ...baseAssessment, fasScore: "FAS_3" as const };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await BehaviorAssessmentService.update("ba-1", "org-1", {
      fasScore: "FAS_3",
    });
    expect(result.fasScore).toBe("FAS_3");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BehaviorAssessmentService.update("ba-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("BehaviorAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await BehaviorAssessmentService.delete("ba-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ba-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      BehaviorAssessmentService.delete("ba-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
