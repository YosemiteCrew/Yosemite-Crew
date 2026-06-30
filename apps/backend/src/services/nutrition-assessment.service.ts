import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class NutritionAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "NutritionAssessmentError";
  }
}

type AppetiteScore = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
type FeedingRoute =
  | "ORAL"
  | "NASOGASTRIC"
  | "ESOPHAGOSTOMY"
  | "GASTROSTOMY"
  | "IV_PARENTERAL";

export interface CreateNutritionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  appetiteScore?: AppetiteScore;
  bodyConditionScore?: number;
  muscleConditionScore?: number;
  currentWeightKg?: number;
  idealWeightKg?: number;
  restingEnergyRequirement?: number;
  feedingRoute?: FeedingRoute;
  currentDiet?: string;
  feedingPlan?: string;
  supplementation?: string[];
  hydrationStatus?: string;
  diagnoses?: string[];
  notes?: string;
}

export type UpdateNutritionParams = Omit<
  CreateNutritionParams,
  "organisationId" | "patientId" | "assessedAt"
>;

export interface ListNutritionParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  appetiteScore?: AppetiteScore;
}

const nutritionSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  appetiteScore: true,
  bodyConditionScore: true,
  muscleConditionScore: true,
  currentWeightKg: true,
  idealWeightKg: true,
  restingEnergyRequirement: true,
  feedingRoute: true,
  currentDiet: true,
  feedingPlan: true,
  supplementation: true,
  hydrationStatus: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NutritionAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.nutritionAssessment.findFirst({
    where: { id, organisationId },
    select: nutritionSelect,
  });
  if (!record) {
    throw new NutritionAssessmentError("Nutrition assessment not found.", 404);
  }
  return record;
};

export const NutritionAssessmentService = {
  async create(params: CreateNutritionParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const assessment = await prisma.nutritionAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        appetiteScore: rest.appetiteScore ?? null,
        bodyConditionScore: rest.bodyConditionScore ?? null,
        muscleConditionScore: rest.muscleConditionScore ?? null,
        currentWeightKg: rest.currentWeightKg ?? null,
        idealWeightKg: rest.idealWeightKg ?? null,
        restingEnergyRequirement: rest.restingEnergyRequirement ?? null,
        feedingRoute: rest.feedingRoute ?? null,
        currentDiet: rest.currentDiet ?? null,
        feedingPlan: rest.feedingPlan ?? null,
        supplementation: rest.supplementation ?? [],
        hydrationStatus: rest.hydrationStatus ?? null,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: nutritionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "NUTRITION_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        appetiteScore: rest.appetiteScore ?? null,
        bodyConditionScore: rest.bodyConditionScore ?? null,
        currentWeightKg: rest.currentWeightKg ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListNutritionParams) {
    const { organisationId, patientId, encounterId, appetiteScore } = params;
    return prisma.nutritionAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(appetiteScore ? { appetiteScore } : {}),
      },
      select: nutritionSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateNutritionParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.NutritionAssessmentUpdateInput = {};
    if (params.assessedBy !== undefined) data.assessedBy = params.assessedBy;
    if (params.appetiteScore !== undefined)
      data.appetiteScore = params.appetiteScore;
    if (params.bodyConditionScore !== undefined)
      data.bodyConditionScore = params.bodyConditionScore;
    if (params.muscleConditionScore !== undefined)
      data.muscleConditionScore = params.muscleConditionScore;
    if (params.currentWeightKg !== undefined)
      data.currentWeightKg = params.currentWeightKg;
    if (params.idealWeightKg !== undefined)
      data.idealWeightKg = params.idealWeightKg;
    if (params.restingEnergyRequirement !== undefined)
      data.restingEnergyRequirement = params.restingEnergyRequirement;
    if (params.feedingRoute !== undefined)
      data.feedingRoute = params.feedingRoute;
    if (params.currentDiet !== undefined) data.currentDiet = params.currentDiet;
    if (params.feedingPlan !== undefined) data.feedingPlan = params.feedingPlan;
    if (params.supplementation !== undefined)
      data.supplementation = params.supplementation;
    if (params.hydrationStatus !== undefined)
      data.hydrationStatus = params.hydrationStatus;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.nutritionAssessment.update({
      where: { id },
      data,
      select: nutritionSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.nutritionAssessment.delete({ where: { id } });
  },
};
