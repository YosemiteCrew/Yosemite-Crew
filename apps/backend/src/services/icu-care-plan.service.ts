import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class IcuCarePlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "IcuCarePlanError";
  }
}

type IcuPlanStatus = "ACTIVE" | "TRANSFERRED" | "DISCHARGED" | "DECEASED";

export interface CreateIcuCarePlanParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  admittedAt: Date;
  onVentilator?: boolean;
  onOxygenSupport?: boolean;
  hasUrinaryCatheter?: boolean;
  hasCentralLine?: boolean;
  hasDrain?: boolean;
  devices?: string;
  dailyGoals?: string;
  nursingFrequency?: string;
  alertThresholds?: string;
  primaryVet?: string;
  nursePrimary?: string;
  anticipatedDischarge?: Date;
  notes?: string;
}

export interface UpdateIcuCarePlanParams {
  onVentilator?: boolean;
  onOxygenSupport?: boolean;
  hasUrinaryCatheter?: boolean;
  hasCentralLine?: boolean;
  hasDrain?: boolean;
  devices?: string;
  dailyGoals?: string;
  nursingFrequency?: string;
  alertThresholds?: string;
  primaryVet?: string;
  nursePrimary?: string;
  anticipatedDischarge?: Date;
  notes?: string;
}

export interface DischargeIcuParams {
  status: "TRANSFERRED" | "DISCHARGED" | "DECEASED";
  dischargeSummary?: string;
}

export interface ListIcuCarePlansParams {
  organisationId: string;
  patientId?: string;
  status?: IcuPlanStatus;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  status: true,
  admittedAt: true,
  onVentilator: true,
  onOxygenSupport: true,
  hasUrinaryCatheter: true,
  hasCentralLine: true,
  hasDrain: true,
  devices: true,
  dailyGoals: true,
  nursingFrequency: true,
  alertThresholds: true,
  primaryVet: true,
  nursePrimary: true,
  anticipatedDischarge: true,
  dischargedAt: true,
  dischargeSummary: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IcuCarePlanSelect;

const assertPlan = async (id: string, organisationId: string) => {
  const record = await prisma.icuCarePlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new IcuCarePlanError("ICU care plan not found.", 404);
  }
  return record;
};

export const IcuCarePlanService = {
  async create(params: CreateIcuCarePlanParams) {
    const {
      organisationId,
      patientId,
      anticipatedDischarge,
      primaryVet,
      ...rest
    } = params;

    const plan = await prisma.icuCarePlan.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        admittedAt: rest.admittedAt,
        status: "ACTIVE",
        onVentilator: rest.onVentilator ?? false,
        onOxygenSupport: rest.onOxygenSupport ?? false,
        hasUrinaryCatheter: rest.hasUrinaryCatheter ?? false,
        hasCentralLine: rest.hasCentralLine ?? false,
        hasDrain: rest.hasDrain ?? false,
        devices: rest.devices ?? null,
        dailyGoals: rest.dailyGoals ?? null,
        nursingFrequency: rest.nursingFrequency ?? null,
        alertThresholds: rest.alertThresholds ?? null,
        primaryVet: primaryVet ?? null,
        nursePrimary: rest.nursePrimary ?? null,
        anticipatedDischarge: anticipatedDischarge ?? null,
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ICU_CARE_PLAN_CREATED",
      actorType: "PMS_USER",
      actorId: primaryVet ?? null,
      entityType: "COMPANION",
      entityId: plan.id,
      metadata: { onVentilator: rest.onVentilator ?? false },
    });

    return plan;
  },

  async get(id: string, organisationId: string) {
    return assertPlan(id, organisationId);
  },

  async list(params: ListIcuCarePlansParams) {
    const { organisationId, patientId, status } = params;
    return prisma.icuCarePlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      select: planSelect,
      orderBy: { admittedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateIcuCarePlanParams,
  ) {
    const existing = await assertPlan(id, organisationId);
    if (existing.status !== "ACTIVE") {
      throw new IcuCarePlanError("Cannot update a closed ICU care plan.", 409);
    }

    const data: Prisma.IcuCarePlanUpdateInput = {};
    if (params.onVentilator !== undefined)
      data.onVentilator = params.onVentilator;
    if (params.onOxygenSupport !== undefined)
      data.onOxygenSupport = params.onOxygenSupport;
    if (params.hasUrinaryCatheter !== undefined)
      data.hasUrinaryCatheter = params.hasUrinaryCatheter;
    if (params.hasCentralLine !== undefined)
      data.hasCentralLine = params.hasCentralLine;
    if (params.hasDrain !== undefined) data.hasDrain = params.hasDrain;
    if (params.devices !== undefined) data.devices = params.devices;
    if (params.dailyGoals !== undefined) data.dailyGoals = params.dailyGoals;
    if (params.nursingFrequency !== undefined)
      data.nursingFrequency = params.nursingFrequency;
    if (params.alertThresholds !== undefined)
      data.alertThresholds = params.alertThresholds;
    if (params.primaryVet !== undefined) data.primaryVet = params.primaryVet;
    if (params.nursePrimary !== undefined)
      data.nursePrimary = params.nursePrimary;
    if (params.anticipatedDischarge !== undefined)
      data.anticipatedDischarge = params.anticipatedDischarge;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.icuCarePlan.update({
      where: { id },
      data,
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ICU_CARE_PLAN_UPDATED",
      actorType: "PMS_USER",
      actorId: params.primaryVet ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async discharge(
    id: string,
    organisationId: string,
    params: DischargeIcuParams,
    dischargedBy?: string,
  ) {
    const existing = await assertPlan(id, organisationId);
    if (existing.status !== "ACTIVE") {
      throw new IcuCarePlanError("ICU care plan is already closed.", 409);
    }

    const updated = await prisma.icuCarePlan.update({
      where: { id },
      data: {
        status: params.status,
        dischargedAt: new Date(),
        dischargeSummary: params.dischargeSummary ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ICU_CARE_PLAN_DISCHARGED",
      actorType: "PMS_USER",
      actorId: dischargedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { status: params.status },
    });

    return updated;
  },
};
