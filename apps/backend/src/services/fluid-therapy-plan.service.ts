import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class FluidTherapyPlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FluidTherapyPlanError";
  }
}

type FluidType =
  | "SALINE_09"
  | "LACTATED_RINGERS"
  | "DEXTROSE_5"
  | "HARTMANNS"
  | "PLASMALYTE"
  | "COLLOID"
  | "BLOOD_PRODUCT"
  | "CUSTOM";

type FluidTherapyStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "DISCONTINUED";

export interface CreateFluidTherapyPlanParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  admissionId?: string;
  fluidType: FluidType;
  customFluidName?: string;
  additives?: string;
  rateMlPerHour: number;
  totalVolumeMl?: number;
  durationHours?: number;
  startedAt: Date;
  endedAt?: Date;
  indication?: string;
  prescribedBy?: string;
  notes?: string;
}

export interface UpdateFluidTherapyPlanParams {
  fluidType?: FluidType;
  customFluidName?: string;
  additives?: string;
  rateMlPerHour?: number;
  totalVolumeMl?: number;
  durationHours?: number;
  endedAt?: Date;
  status?: FluidTherapyStatus;
  indication?: string;
  notes?: string;
}

export interface ListFluidTherapyPlansParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  admissionId?: string;
  status?: FluidTherapyStatus;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  admissionId: true,
  fluidType: true,
  customFluidName: true,
  additives: true,
  rateMlPerHour: true,
  totalVolumeMl: true,
  durationHours: true,
  startedAt: true,
  endedAt: true,
  status: true,
  indication: true,
  prescribedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FluidTherapyPlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const record = await prisma.fluidTherapyPlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new FluidTherapyPlanError("Fluid therapy plan not found.", 404);
  }
  return record;
};

export const FluidTherapyPlanService = {
  async create(params: CreateFluidTherapyPlanParams) {
    const { organisationId, patientId, prescribedBy, ...rest } = params;

    const record = await prisma.fluidTherapyPlan.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        admissionId: rest.admissionId ?? null,
        fluidType: rest.fluidType,
        customFluidName: rest.customFluidName ?? null,
        additives: rest.additives ?? null,
        rateMlPerHour: rest.rateMlPerHour,
        totalVolumeMl: rest.totalVolumeMl ?? null,
        durationHours: rest.durationHours ?? null,
        startedAt: rest.startedAt,
        endedAt: rest.endedAt ?? null,
        status: "ACTIVE",
        indication: rest.indication ?? null,
        prescribedBy: prescribedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "FLUID_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: prescribedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        fluidType: rest.fluidType,
        rateMlPerHour: rest.rateMlPerHour,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListFluidTherapyPlansParams) {
    const { organisationId, patientId, encounterId, admissionId, status } =
      params;
    return prisma.fluidTherapyPlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(admissionId ? { admissionId } : {}),
        ...(status ? { status } : {}),
      },
      select: planSelect,
      orderBy: { startedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateFluidTherapyPlanParams,
    updatedBy?: string,
  ) {
    const record = await assertPlan(id, organisationId);
    if (record.status === "DISCONTINUED") {
      throw new FluidTherapyPlanError(
        "Cannot update a discontinued fluid plan.",
        409,
      );
    }

    const data: Prisma.FluidTherapyPlanUpdateInput = {};
    if (params.fluidType !== undefined) data.fluidType = params.fluidType;
    if (params.customFluidName !== undefined)
      data.customFluidName = params.customFluidName;
    if (params.additives !== undefined) data.additives = params.additives;
    if (params.rateMlPerHour !== undefined)
      data.rateMlPerHour = params.rateMlPerHour;
    if (params.totalVolumeMl !== undefined)
      data.totalVolumeMl = params.totalVolumeMl;
    if (params.durationHours !== undefined)
      data.durationHours = params.durationHours;
    if (params.endedAt !== undefined) data.endedAt = params.endedAt;
    if (params.status !== undefined) data.status = params.status;
    if (params.indication !== undefined) data.indication = params.indication;
    if (params.notes !== undefined) data.notes = params.notes;

    const eventType =
      params.status === "DISCONTINUED"
        ? "FLUID_PLAN_DISCONTINUED"
        : "FLUID_PLAN_UPDATED";

    const updated = await prisma.fluidTherapyPlan.update({
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
      metadata: { status: updated.status },
    });

    return updated;
  },
};
