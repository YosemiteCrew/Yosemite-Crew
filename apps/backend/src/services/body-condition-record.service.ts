import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class BodyConditionRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BodyConditionRecordError";
  }
}

type BcsScale = "BCS_5" | "BCS_9";

export interface CreateBodyConditionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  bcsScale: BcsScale;
  bcsScore: number;
  muscleConditionScore?: string;
  weightKg?: number;
  bodyFatPercentage?: number;
  recordedAt: Date;
  recordedBy?: string;
  notes?: string;
}

const bcsSelect = {
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
    select: bcsSelect,
  });
  if (!record)
    throw new BodyConditionRecordError("Body condition record not found.", 404);
  return record;
};

export const BodyConditionRecordService = {
  async create(params: CreateBodyConditionParams) {
    const record = await prisma.bodyConditionRecord.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        bcsScale: params.bcsScale,
        bcsScore: params.bcsScore,
        muscleConditionScore: params.muscleConditionScore ?? null,
        weightKg: params.weightKg ?? null,
        bodyFatPercentage: params.bodyFatPercentage ?? null,
        recordedAt: params.recordedAt,
        recordedBy: params.recordedBy ?? null,
        notes: params.notes ?? null,
      },
      select: bcsSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "BODY_CONDITION_RECORDED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        bcsScale: params.bcsScale,
        bcsScore: params.bcsScore,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    encounterId?: string;
    bcsScale?: BcsScale;
  }) {
    const { organisationId, patientId, encounterId, bcsScale } = params;
    return prisma.bodyConditionRecord.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(bcsScale ? { bcsScale } : {}),
      },
      select: bcsSelect,
      orderBy: { recordedAt: "desc" },
    });
  },

  async trend(patientId: string, organisationId: string, limit = 20) {
    return prisma.bodyConditionRecord.findMany({
      where: { patientId, organisationId },
      select: bcsSelect,
      orderBy: { recordedAt: "asc" },
      take: limit,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.bodyConditionRecord.delete({ where: { id } });
  },
};
