import { NutritionAssessmentService } from "../../src/services/nutrition-assessment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    nutritionAssessment: {
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

const mockCreate = prisma.nutritionAssessment.create as jest.Mock;
const mockFindFirst = prisma.nutritionAssessment.findFirst as jest.Mock;
const mockFindMany = prisma.nutritionAssessment.findMany as jest.Mock;
const mockUpdate = prisma.nutritionAssessment.update as jest.Mock;
const mockDelete = prisma.nutritionAssessment.delete as jest.Mock;

const baseAssessment = {
  id: "nut-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  assessedAt: new Date("2026-06-30T10:00:00Z"),
  assessedBy: "vet-1",
  appetiteScore: "FAIR" as const,
  bodyConditionScore: 3,
  muscleConditionScore: 2,
  currentWeightKg: 4.2,
  idealWeightKg: 5.5,
  restingEnergyRequirement: 185.0,
  feedingRoute: "ORAL" as const,
  currentDiet: "Hill's k/d",
  feedingPlan: "Increase caloric intake to 1.2x RER via small frequent meals",
  supplementation: ["B12", "omega-3"],
  hydrationStatus: "MILD_DEHYDRATION",
  diagnoses: ["Cachexia secondary to CKD"],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("NutritionAssessmentService.create", () => {
  it("creates assessment with BCS, weight, and feeding plan", async () => {
    mockCreate.mockResolvedValue(baseAssessment);
    const result = await NutritionAssessmentService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      assessedAt: new Date("2026-06-30T10:00:00Z"),
      appetiteScore: "FAIR",
      bodyConditionScore: 3,
      currentWeightKg: 4.2,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appetiteScore: "FAIR",
          bodyConditionScore: 3,
          currentWeightKg: 4.2,
        }),
      }),
    );
    expect(result.bodyConditionScore).toBe(3);
  });
});

describe("NutritionAssessmentService.get", () => {
  it("returns assessment when found", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    const result = await NutritionAssessmentService.get("nut-1", "org-1");
    expect(result.id).toBe("nut-1");
    expect(result.feedingRoute).toBe("ORAL");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NutritionAssessmentService.get("nut-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("NutritionAssessmentService.list", () => {
  it("filters by appetite score", async () => {
    mockFindMany.mockResolvedValue([baseAssessment]);
    await NutritionAssessmentService.list({
      organisationId: "org-1",
      appetiteScore: "FAIR",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appetiteScore: "FAIR" }),
      }),
    );
  });
});

describe("NutritionAssessmentService.update", () => {
  it("updates weight and BCS after recheck", async () => {
    const updated = {
      ...baseAssessment,
      currentWeightKg: 4.6,
      bodyConditionScore: 4,
    };
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockUpdate.mockResolvedValue(updated);
    const result = await NutritionAssessmentService.update("nut-1", "org-1", {
      currentWeightKg: 4.6,
      bodyConditionScore: 4,
    });
    expect(result.currentWeightKg).toBe(4.6);
    expect(result.bodyConditionScore).toBe(4);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NutritionAssessmentService.update("nut-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("NutritionAssessmentService.delete", () => {
  it("deletes an assessment", async () => {
    mockFindFirst.mockResolvedValue(baseAssessment);
    mockDelete.mockResolvedValue(undefined);
    await NutritionAssessmentService.delete("nut-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "nut-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      NutritionAssessmentService.delete("nut-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
