import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ControlledSubstanceLogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ControlledSubstanceLogError";
  }
}

type DeaSchedule = "II" | "III" | "IV" | "V";
type DrugUnit = "ML" | "MG" | "MCG" | "TABLET" | "CAPSULE" | "PATCH" | "UNIT";

export interface CreateCsLogParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  loggedAt: Date;
  drug: string;
  deaSchedule: DeaSchedule;
  lotNumber?: string;
  strength?: number;
  unit: DrugUnit;
  amountDrawn: number;
  amountAdministered: number;
  amountWasted?: number;
  wastedWitness?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  administeredBy?: string;
  notes?: string;
}

export type UpdateCsLogParams = Partial<
  Omit<
    CreateCsLogParams,
    | "organisationId"
    | "patientId"
    | "loggedAt"
    | "drug"
    | "deaSchedule"
    | "unit"
  >
>;

export interface ListCsLogParams {
  organisationId: string;
  patientId?: string;
  drug?: string;
  deaSchedule?: DeaSchedule;
  fromDate?: Date;
  toDate?: Date;
}

const csLogSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  loggedAt: true,
  drug: true,
  deaSchedule: true,
  lotNumber: true,
  strength: true,
  unit: true,
  amountDrawn: true,
  amountAdministered: true,
  amountWasted: true,
  wastedWitness: true,
  balanceBefore: true,
  balanceAfter: true,
  administeredBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ControlledSubstanceLogSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.controlledSubstanceLog.findFirst({
    where: { id, organisationId },
    select: csLogSelect,
  });
  if (!record) {
    throw new ControlledSubstanceLogError(
      "Controlled substance log entry not found.",
      404,
    );
  }
  return record;
};

export const ControlledSubstanceLogService = {
  async create(params: CreateCsLogParams) {
    const { organisationId, administeredBy, ...rest } = params;

    const record = await prisma.controlledSubstanceLog.create({
      data: {
        organisationId,
        patientId: rest.patientId ?? null,
        encounterId: rest.encounterId ?? null,
        loggedAt: rest.loggedAt,
        drug: rest.drug,
        deaSchedule: rest.deaSchedule,
        lotNumber: rest.lotNumber ?? null,
        strength: rest.strength ?? null,
        unit: rest.unit,
        amountDrawn: rest.amountDrawn,
        amountAdministered: rest.amountAdministered,
        amountWasted: rest.amountWasted ?? 0,
        wastedWitness: rest.wastedWitness ?? null,
        balanceBefore: rest.balanceBefore ?? null,
        balanceAfter: rest.balanceAfter ?? null,
        administeredBy: administeredBy ?? null,
        notes: rest.notes ?? null,
      },
      select: csLogSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: rest.patientId ?? "",
      eventType: "CONTROLLED_SUBSTANCE_LOGGED",
      actorType: "PMS_USER",
      actorId: administeredBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        drug: rest.drug,
        deaSchedule: rest.deaSchedule,
        amountAdministered: rest.amountAdministered,
        unit: rest.unit,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListCsLogParams) {
    const { organisationId, patientId, drug, deaSchedule, fromDate, toDate } =
      params;
    return prisma.controlledSubstanceLog.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(drug ? { drug: { contains: drug, mode: "insensitive" } } : {}),
        ...(deaSchedule ? { deaSchedule } : {}),
        ...(fromDate || toDate
          ? {
              loggedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      select: csLogSelect,
      orderBy: { loggedAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdateCsLogParams) {
    await assertRecord(id, organisationId);

    const data: Prisma.ControlledSubstanceLogUpdateInput = {};
    if (params.lotNumber !== undefined) data.lotNumber = params.lotNumber;
    if (params.strength !== undefined) data.strength = params.strength;
    if (params.amountDrawn !== undefined) data.amountDrawn = params.amountDrawn;
    if (params.amountAdministered !== undefined)
      data.amountAdministered = params.amountAdministered;
    if (params.amountWasted !== undefined)
      data.amountWasted = params.amountWasted;
    if (params.wastedWitness !== undefined)
      data.wastedWitness = params.wastedWitness;
    if (params.balanceBefore !== undefined)
      data.balanceBefore = params.balanceBefore;
    if (params.balanceAfter !== undefined)
      data.balanceAfter = params.balanceAfter;
    if (params.administeredBy !== undefined)
      data.administeredBy = params.administeredBy;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.controlledSubstanceLog.update({
      where: { id },
      data,
      select: csLogSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.controlledSubstanceLog.delete({ where: { id } });
  },
};
