import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class VitalSignError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "VitalSignError";
  }
}

export interface RecordVitalSignParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  recordedAt?: Date;
  recordedBy?: string;
  weightKg?: number;
  temperatureCelsius?: number;
  pulseRateBpm?: number;
  respiratoryRateBpm?: number;
  systolicBp?: number;
  diastolicBp?: number;
  bodyConditionScore?: number;
  mucosal?: string;
  capRefillTimeSec?: number;
  notes?: string;
}

export interface UpdateVitalSignParams {
  weightKg?: number;
  temperatureCelsius?: number;
  pulseRateBpm?: number;
  respiratoryRateBpm?: number;
  systolicBp?: number;
  diastolicBp?: number;
  bodyConditionScore?: number;
  mucosal?: string;
  capRefillTimeSec?: number;
  notes?: string;
}

export interface ListVitalSignsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

const vitalSignSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  recordedAt: true,
  recordedBy: true,
  weightKg: true,
  temperatureCelsius: true,
  pulseRateBpm: true,
  respiratoryRateBpm: true,
  systolicBp: true,
  diastolicBp: true,
  bodyConditionScore: true,
  mucosal: true,
  capRefillTimeSec: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientVitalSignSelect;

const assertVitalSign = async (id: string, organisationId: string) => {
  const entry = await prisma.patientVitalSign.findFirst({
    where: { id, organisationId },
    select: vitalSignSelect,
  });
  if (!entry) {
    throw new VitalSignError("Vital sign record not found.", 404);
  }
  return entry;
};

export const VitalSignService = {
  async record(params: RecordVitalSignParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      recordedAt,
      recordedBy,
      ...measurements
    } = params;

    const entry = await prisma.patientVitalSign.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        recordedAt: recordedAt ?? new Date(),
        recordedBy: recordedBy ?? null,
        ...measurements,
      },
      select: vitalSignSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "VITAL_SIGNS_RECORDED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: entry.id,
      metadata: {
        encounterId: encounterId ?? null,
        weightKg: measurements.weightKg ?? null,
      },
    });

    return entry;
  },

  async get(id: string, organisationId: string) {
    return assertVitalSign(id, organisationId);
  },

  async list(params: ListVitalSignsParams) {
    const { organisationId, patientId, encounterId, from, to, limit } = params;
    return prisma.patientVitalSign.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(from || to
          ? {
              recordedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: vitalSignSelect,
      orderBy: { recordedAt: "desc" },
      take: limit ?? 200,
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateVitalSignParams,
    updatedBy?: string,
  ) {
    await assertVitalSign(id, organisationId);

    const data: Prisma.PatientVitalSignUpdateInput = {};
    if (params.weightKg !== undefined) data.weightKg = params.weightKg;
    if (params.temperatureCelsius !== undefined)
      data.temperatureCelsius = params.temperatureCelsius;
    if (params.pulseRateBpm !== undefined)
      data.pulseRateBpm = params.pulseRateBpm;
    if (params.respiratoryRateBpm !== undefined)
      data.respiratoryRateBpm = params.respiratoryRateBpm;
    if (params.systolicBp !== undefined) data.systolicBp = params.systolicBp;
    if (params.diastolicBp !== undefined) data.diastolicBp = params.diastolicBp;
    if (params.bodyConditionScore !== undefined)
      data.bodyConditionScore = params.bodyConditionScore;
    if (params.mucosal !== undefined) data.mucosal = params.mucosal;
    if (params.capRefillTimeSec !== undefined)
      data.capRefillTimeSec = params.capRefillTimeSec;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.patientVitalSign.update({
      where: { id },
      data,
      select: vitalSignSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: updated.patientId,
      eventType: "VITAL_SIGNS_UPDATED",
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { changedFields: Object.keys(params) },
    });

    return updated;
  },

  async delete(id: string, organisationId: string) {
    await assertVitalSign(id, organisationId);
    await prisma.patientVitalSign.delete({ where: { id } });
  },
};
