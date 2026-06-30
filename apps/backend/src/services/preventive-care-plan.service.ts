import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PreventiveCarePlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PreventiveCarePlanError";
  }
}

type PreventiveCareFrequency =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "BIANNUAL"
  | "ANNUAL"
  | "CUSTOM";

type PreventiveCareStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface CreatePreventiveCarePlanParams {
  organisationId: string;
  patientId: string;
  name: string;
  description?: string;
  createdBy?: string;
  items?: Array<{
    careType: string;
    frequency: PreventiveCareFrequency;
    intervalDays?: number;
    nextDueAt?: Date;
    notes?: string;
  }>;
}

export interface UpdatePreventiveCarePlanParams {
  name?: string;
  description?: string;
  status?: PreventiveCareStatus;
}

export interface ListPreventiveCarePlansParams {
  organisationId: string;
  patientId?: string;
  status?: PreventiveCareStatus;
}

export interface CompleteItemParams {
  completedAt?: Date;
  nextDueAt?: Date;
  notes?: string;
}

const itemSelect = {
  id: true,
  planId: true,
  organisationId: true,
  careType: true,
  frequency: true,
  intervalDays: true,
  lastDoneAt: true,
  nextDueAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PreventiveCareItemSelect;

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  name: true,
  description: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  items: { select: itemSelect, orderBy: { nextDueAt: "asc" } },
} satisfies Prisma.PreventiveCarePlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const plan = await prisma.preventiveCarePlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!plan) {
    throw new PreventiveCarePlanError("Preventive care plan not found.", 404);
  }
  return plan;
};

const assertItem = async (id: string, organisationId: string) => {
  const item = await prisma.preventiveCareItem.findFirst({
    where: { id, organisationId },
    select: itemSelect,
  });
  if (!item) {
    throw new PreventiveCarePlanError("Care plan item not found.", 404);
  }
  return item;
};

export const PreventiveCarePlanService = {
  async create(params: CreatePreventiveCarePlanParams) {
    const { organisationId, patientId, name, description, createdBy, items } =
      params;

    const plan = await prisma.preventiveCarePlan.create({
      data: {
        organisationId,
        patientId,
        name,
        description: description ?? null,
        status: "ACTIVE",
        createdBy: createdBy ?? null,
        ...(items?.length
          ? {
              items: {
                create: items.map((item) => ({
                  organisationId,
                  careType: item.careType,
                  frequency: item.frequency,
                  intervalDays: item.intervalDays ?? null,
                  nextDueAt: item.nextDueAt ?? null,
                  notes: item.notes ?? null,
                })),
              },
            }
          : {}),
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "CARE_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: createdBy ?? null,
      entityType: "COMPANION",
      entityId: plan.id,
      metadata: { name, itemCount: plan.items.length },
    });

    return plan;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListPreventiveCarePlansParams) {
    const { organisationId, patientId, status } = params;
    return prisma.preventiveCarePlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      select: planSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdatePreventiveCarePlanParams,
    updatedBy?: string,
  ) {
    const plan = await assertPlan(id, organisationId);

    const data: Prisma.PreventiveCarePlanUpdateInput = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.description !== undefined) data.description = params.description;
    if (params.status !== undefined) data.status = params.status;

    const updated = await prisma.preventiveCarePlan.update({
      where: { id },
      data,
      select: planSelect,
    });

    const eventType =
      params.status === "CANCELLED"
        ? "CARE_PLAN_CANCELLED"
        : "CARE_PLAN_UPDATED";

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: plan.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { changedFields: Object.keys(params) },
    });

    return updated;
  },

  async addItem(
    planId: string,
    organisationId: string,
    item: {
      careType: string;
      frequency: PreventiveCareFrequency;
      intervalDays?: number;
      nextDueAt?: Date;
      notes?: string;
    },
  ) {
    await assertPlan(planId, organisationId);
    return prisma.preventiveCareItem.create({
      data: {
        planId,
        organisationId,
        careType: item.careType,
        frequency: item.frequency,
        intervalDays: item.intervalDays ?? null,
        nextDueAt: item.nextDueAt ?? null,
        notes: item.notes ?? null,
      },
      select: itemSelect,
    });
  },

  async completeItem(
    itemId: string,
    organisationId: string,
    params: CompleteItemParams,
    actorId?: string,
  ) {
    const item = await assertItem(itemId, organisationId);
    const completedAt = params.completedAt ?? new Date();

    const updated = await prisma.preventiveCareItem.update({
      where: { id: itemId },
      data: {
        lastDoneAt: completedAt,
        nextDueAt: params.nextDueAt ?? null,
        notes: params.notes !== undefined ? params.notes : item.notes,
      },
      select: itemSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId:
        (
          await prisma.preventiveCarePlan.findFirst({
            where: { id: item.planId },
            select: { patientId: true },
          })
        )?.patientId ?? "",
      eventType: "CARE_PLAN_ITEM_COMPLETED",
      actorType: "PMS_USER",
      actorId: actorId ?? null,
      entityType: "COMPANION",
      entityId: itemId,
      metadata: {
        careType: item.careType,
        completedAt,
        nextDueAt: params.nextDueAt ?? null,
      },
    });

    return updated;
  },
};
