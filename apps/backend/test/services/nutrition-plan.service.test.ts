import { NutritionPlanService } from "src/services/nutrition-plan.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    nutritionPlan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  nutritionPlan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makePlan = (over: Record<string, unknown> = {}) => ({
  id: "np-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  status: "ACTIVE",
  dietName: "Renal Diet Phase 1",
  calories: 350,
  calorieUnit: "kcal/day",
  protein: 18,
  fat: 12,
  fibre: 3,
  feedingFrequency: "3x daily",
  portionSize: "80g per meal",
  waterIntake: "At least 150ml/day",
  restrictions: "No high phosphorus foods",
  indication: "Chronic kidney disease Stage 2",
  prescribedBy: "vet-1",
  reviewDate: new Date("2026-07-30"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.nutritionPlan.findFirst.mockResolvedValue(makePlan());
  pm.nutritionPlan.create.mockResolvedValue(makePlan());
  pm.nutritionPlan.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makePlan({ ...args.data })),
  );
  pm.nutritionPlan.findMany.mockResolvedValue([makePlan()]);
});

describe("NutritionPlanService.create", () => {
  it("creates an ACTIVE nutrition plan and emits audit", async () => {
    const result = await NutritionPlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      dietName: "Renal Diet Phase 1",
      calories: 350,
      indication: "CKD Stage 2",
      prescribedBy: "vet-1",
    });
    expect(pm.nutritionPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dietName: "Renal Diet Phase 1",
          status: "ACTIVE",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NUTRITION_PLAN_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });
});

describe("NutritionPlanService.get", () => {
  it("returns a plan by id and org", async () => {
    const result = await NutritionPlanService.get("np-1", "org-1");
    expect(result.id).toBe("np-1");
  });

  it("404s an unknown plan", async () => {
    pm.nutritionPlan.findFirst.mockResolvedValue(null);
    await expect(
      NutritionPlanService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("NutritionPlanService.list", () => {
  it("lists plans for the org", async () => {
    const result = await NutritionPlanService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and status", async () => {
    await NutritionPlanService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.nutritionPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

describe("NutritionPlanService.update", () => {
  it("updates the diet name and emits NUTRITION_PLAN_UPDATED", async () => {
    await NutritionPlanService.update(
      "np-1",
      "org-1",
      { dietName: "Renal Diet Phase 2" },
      "vet-1",
    );
    expect(pm.nutritionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dietName: "Renal Diet Phase 2" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "NUTRITION_PLAN_UPDATED" }),
    );
  });

  it("emits NUTRITION_PLAN_DISCONTINUED when status is DISCONTINUED", async () => {
    pm.nutritionPlan.update.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await NutritionPlanService.update("np-1", "org-1", {
      status: "DISCONTINUED",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "NUTRITION_PLAN_DISCONTINUED" }),
    );
  });

  it("rejects updates on a discontinued plan", async () => {
    pm.nutritionPlan.findFirst.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await expect(
      NutritionPlanService.update("np-1", "org-1", { calories: 400 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
