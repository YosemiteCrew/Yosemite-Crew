import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class BodyConditionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BodyConditionError";
  }
}

type BodyConditionScaleType = "BCS_5" | "BCS_9";

export interface RecordBodyConditionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  bcsScale: BodyConditionScaleType;
  bcsScore: number;
  muscleConditionScore?: string;
  weightKg?: number;
  bodyFatPercentage?: number;
  recordedAt: Date;
  recordedBy?: string;
  notes?: string;
}

export interface ListBodyConditionParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  bcsScale?: BodyConditionScaleType;
  from?: Date;
  to?: Date;
}

const recordSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  bcsScale: true,
  bcsScore: true,
  muscleConditionScore: true,
  weightKg: true,
  bodyFatPercentage: true,
  recordedAt: true,
  recordedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BodyConditionRecordSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.bodyConditionRecord.findFirst({
    where: { id, organisationId },
    select: recordSelect,
  });
  if (!record) {
    throw new BodyConditionError("Body condition record not found.", 404);
  }
  return record;
};

export const BodyConditionService = {
  async record(params: RecordBodyConditionParams) {
    const { organisationId, patientId, recordedBy, ...rest } = params;

    const bcr = await prisma.bodyConditionRecord.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        bcsScale: rest.bcsScale,
        bcsScore: rest.bcsScore,
        muscleConditionScore: rest.muscleConditionScore ?? null,
        weightKg: rest.weightKg ?? null,
        bodyFatPercentage: rest.bodyFatPercentage ?? null,
        recordedAt: rest.recordedAt,
        recordedBy: recordedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: recordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "BODY_CONDITION_RECORDED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: bcr.id,
      metadata: {
        bcsScale: rest.bcsScale,
        bcsScore: rest.bcsScore,
        weightKg: rest.weightKg ?? null,
      },
    });

    return bcr;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListBodyConditionParams) {
    const { organisationId, patientId, encounterId, bcsScale, from, to } =
      params;
    return prisma.bodyConditionRecord.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(bcsScale ? { bcsScale } : {}),
        ...(from || to
          ? {
              recordedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: recordSelect,
      orderBy: { recordedAt: "asc" },
    });
  },

  async trend(patientId: string, organisationId: string, limit = 20) {
    return prisma.bodyConditionRecord.findMany({
      where: { patientId, organisationId },
      select: recordSelect,
      orderBy: { recordedAt: "asc" },
      take: limit,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.bodyConditionRecord.delete({ where: { id } });
  },
};
