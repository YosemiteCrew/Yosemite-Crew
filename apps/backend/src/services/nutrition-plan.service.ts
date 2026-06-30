import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class NutritionPlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "NutritionPlanError";
  }
}

type NutritionPlanStatus = "ACTIVE" | "COMPLETED" | "DISCONTINUED";

export interface CreateNutritionPlanParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  dietName: string;
  calories?: number;
  calorieUnit?: string;
  protein?: number;
  fat?: number;
  fibre?: number;
  feedingFrequency?: string;
  portionSize?: string;
  waterIntake?: string;
  restrictions?: string;
  indication?: string;
  prescribedBy?: string;
  reviewDate?: Date;
  notes?: string;
}

export interface UpdateNutritionPlanParams {
  dietName?: string;
  calories?: number;
  calorieUnit?: string;
  protein?: number;
  fat?: number;
  fibre?: number;
  feedingFrequency?: string;
  portionSize?: string;
  waterIntake?: string;
  restrictions?: string;
  indication?: string;
  reviewDate?: Date;
  notes?: string;
  status?: NutritionPlanStatus;
}

export interface ListNutritionPlansParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: NutritionPlanStatus;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  status: true,
  dietName: true,
  calories: true,
  calorieUnit: true,
  protein: true,
  fat: true,
  fibre: true,
  feedingFrequency: true,
  portionSize: true,
  waterIntake: true,
  restrictions: true,
  indication: true,
  prescribedBy: true,
  reviewDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NutritionPlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const record = await prisma.nutritionPlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new NutritionPlanError("Nutrition plan not found.", 404);
  }
  return record;
};

export const NutritionPlanService = {
  async create(params: CreateNutritionPlanParams) {
    const { organisationId, patientId, prescribedBy, ...rest } = params;

    const record = await prisma.nutritionPlan.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        status: "ACTIVE",
        dietName: rest.dietName,
        calories: rest.calories ?? null,
        calorieUnit: rest.calorieUnit ?? null,
        protein: rest.protein ?? null,
        fat: rest.fat ?? null,
        fibre: rest.fibre ?? null,
        feedingFrequency: rest.feedingFrequency ?? null,
        portionSize: rest.portionSize ?? null,
        waterIntake: rest.waterIntake ?? null,
        restrictions: rest.restrictions ?? null,
        indication: rest.indication ?? null,
        prescribedBy: prescribedBy ?? null,
        reviewDate: rest.reviewDate ?? null,
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "NUTRITION_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: prescribedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { dietName: rest.dietName },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListNutritionPlansParams) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.nutritionPlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
      },
      select: planSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateNutritionPlanParams,
    updatedBy?: string,
  ) {
    const record = await assertPlan(id, organisationId);
    if (record.status === "DISCONTINUED") {
      throw new NutritionPlanError(
        "Cannot update a discontinued nutrition plan.",
        409,
      );
    }

    const data: Prisma.NutritionPlanUpdateInput = {};
    if (params.dietName !== undefined) data.dietName = params.dietName;
    if (params.calories !== undefined) data.calories = params.calories;
    if (params.calorieUnit !== undefined) data.calorieUnit = params.calorieUnit;
    if (params.protein !== undefined) data.protein = params.protein;
    if (params.fat !== undefined) data.fat = params.fat;
    if (params.fibre !== undefined) data.fibre = params.fibre;
    if (params.feedingFrequency !== undefined)
      data.feedingFrequency = params.feedingFrequency;
    if (params.portionSize !== undefined) data.portionSize = params.portionSize;
    if (params.waterIntake !== undefined) data.waterIntake = params.waterIntake;
    if (params.restrictions !== undefined)
      data.restrictions = params.restrictions;
    if (params.indication !== undefined) data.indication = params.indication;
    if (params.reviewDate !== undefined) data.reviewDate = params.reviewDate;
    if (params.notes !== undefined) data.notes = params.notes;
    if (params.status !== undefined) data.status = params.status;

    const eventType =
      params.status === "DISCONTINUED"
        ? "NUTRITION_PLAN_DISCONTINUED"
        : "NUTRITION_PLAN_UPDATED";

    const updated = await prisma.nutritionPlan.update({
      where: { id },
      data,
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { dietName: updated.dietName, status: updated.status },
    });

    return updated;
  },
};
