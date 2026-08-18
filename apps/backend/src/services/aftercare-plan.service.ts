import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class AftercarePlanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AftercarePlanError";
  }
}

type AftercareType =
  | "EUTHANASIA_SERVICE"
  | "CREMATION_PRIVATE"
  | "CREMATION_COMMUNAL"
  | "AQUAMATION"
  | "BURIAL"
  | "HOME_CARE"
  | "DONATION_TO_SCIENCE";

export interface CreateAftercarePlanParams {
  organisationId: string;
  patientId: string;
  type: AftercareType;
  provider?: string;
  estimatedCost?: number;
  depositPaid?: number;
  pawPrintRequested?: boolean;
  furClippingRequested?: boolean;
  urnsRequested?: number;
  instructions?: string;
  certificateNumber?: string;
  completedAt?: Date;
  notes?: string;
  recordedBy?: string;
}

export type UpdateAftercarePlanParams = Partial<
  Omit<CreateAftercarePlanParams, "organisationId" | "patientId" | "type">
>;

export interface ListAftercarePlanParams {
  organisationId: string;
  patientId?: string;
  type?: AftercareType;
  completed?: boolean;
}

const planSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  type: true,
  provider: true,
  estimatedCost: true,
  depositPaid: true,
  pawPrintRequested: true,
  furClippingRequested: true,
  urnsRequested: true,
  instructions: true,
  certificateNumber: true,
  completedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AftercarePlanSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.aftercarePlan.findFirst({
    where: { id, organisationId },
    select: planSelect,
  });
  if (!record) {
    throw new AftercarePlanError("Aftercare plan not found.", 404);
  }
  return record;
};

export const AftercarePlanService = {
  async create(params: CreateAftercarePlanParams) {
    const { organisationId, patientId, recordedBy, ...rest } = params;

    const record = await prisma.aftercarePlan.create({
      data: {
        organisationId,
        patientId,
        type: rest.type,
        provider: rest.provider ?? null,
        estimatedCost: rest.estimatedCost ?? null,
        depositPaid: rest.depositPaid ?? null,
        pawPrintRequested: rest.pawPrintRequested ?? false,
        furClippingRequested: rest.furClippingRequested ?? false,
        urnsRequested: rest.urnsRequested ?? null,
        instructions: rest.instructions ?? null,
        certificateNumber: rest.certificateNumber ?? null,
        completedAt: rest.completedAt ?? null,
        notes: rest.notes ?? null,
      },
      select: planSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "AFTERCARE_PLAN_RECORDED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        type: rest.type,
        provider: rest.provider ?? null,
        completedAt: rest.completedAt?.toISOString() ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListAftercarePlanParams) {
    const { organisationId, patientId, type, completed } = params;
    return prisma.aftercarePlan.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(type ? { type } : {}),
        ...(completed === true ? { completedAt: { not: null } } : {}),
        ...(completed === false ? { completedAt: null } : {}),
      },
      select: planSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateAftercarePlanParams,
  ) {
    await assertRecord(id, organisationId);

    const data: Prisma.AftercarePlanUpdateInput = {};
    if (params.provider !== undefined) data.provider = params.provider;
    if (params.estimatedCost !== undefined)
      data.estimatedCost = params.estimatedCost;
    if (params.depositPaid !== undefined) data.depositPaid = params.depositPaid;
    if (params.pawPrintRequested !== undefined)
      data.pawPrintRequested = params.pawPrintRequested;
    if (params.furClippingRequested !== undefined)
      data.furClippingRequested = params.furClippingRequested;
    if (params.urnsRequested !== undefined)
      data.urnsRequested = params.urnsRequested;
    if (params.instructions !== undefined)
      data.instructions = params.instructions;
    if (params.certificateNumber !== undefined)
      data.certificateNumber = params.certificateNumber;
    if (params.completedAt !== undefined) data.completedAt = params.completedAt;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.aftercarePlan.update({
      where: { id },
      data,
      select: planSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.aftercarePlan.delete({ where: { id } });
  },
};
