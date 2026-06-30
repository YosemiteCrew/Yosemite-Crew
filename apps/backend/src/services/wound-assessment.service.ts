import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class WoundAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WoundAssessmentError";
  }
}

type WoundType =
  | "SURGICAL_INCISION"
  | "LACERATION"
  | "PUNCTURE"
  | "ABRASION"
  | "BURN"
  | "PRESSURE_SORE"
  | "ULCER"
  | "BITE_WOUND"
  | "OTHER";

type WoundHealingStage =
  | "HAEMOSTASIS"
  | "INFLAMMATION"
  | "PROLIFERATION"
  | "MATURATION";

type WoundHealingStatus =
  | "HEALING"
  | "STATIC"
  | "DETERIORATING"
  | "HEALED"
  | "COMPLICATED";

export interface RecordWoundAssessmentParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  woundType: WoundType;
  location: string;
  lengthCm?: number;
  widthCm?: number;
  depthCm?: number;
  healingStage?: WoundHealingStage;
  healingStatus?: WoundHealingStatus;
  exudateType?: string;
  exudateAmount?: string;
  odour?: string;
  woundBed?: string;
  woundEdges?: string;
  periwoundSkin?: string;
  dressing?: string;
  dressingChangeFreq?: string;
  assessedAt: Date;
  assessedBy?: string;
  notes?: string;
}

export interface ListWoundAssessmentsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  from?: Date;
  to?: Date;
}

const assessmentSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  surgicalProcedureId: true,
  woundType: true,
  location: true,
  lengthCm: true,
  widthCm: true,
  depthCm: true,
  healingStage: true,
  healingStatus: true,
  exudateType: true,
  exudateAmount: true,
  odour: true,
  woundBed: true,
  woundEdges: true,
  periwoundSkin: true,
  dressing: true,
  dressingChangeFreq: true,
  assessedAt: true,
  assessedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WoundAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.woundAssessment.findFirst({
    where: { id, organisationId },
    select: assessmentSelect,
  });
  if (!record) {
    throw new WoundAssessmentError("Wound assessment not found.", 404);
  }
  return record;
};

export const WoundAssessmentService = {
  async record(params: RecordWoundAssessmentParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const assessment = await prisma.woundAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
        woundType: rest.woundType,
        location: rest.location,
        lengthCm: rest.lengthCm ?? null,
        widthCm: rest.widthCm ?? null,
        depthCm: rest.depthCm ?? null,
        healingStage: rest.healingStage ?? null,
        healingStatus: rest.healingStatus ?? "HEALING",
        exudateType: rest.exudateType ?? null,
        exudateAmount: rest.exudateAmount ?? null,
        odour: rest.odour ?? null,
        woundBed: rest.woundBed ?? null,
        woundEdges: rest.woundEdges ?? null,
        periwoundSkin: rest.periwoundSkin ?? null,
        dressing: rest.dressing ?? null,
        dressingChangeFreq: rest.dressingChangeFreq ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: assessmentSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "WOUND_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        woundType: rest.woundType,
        healingStatus: rest.healingStatus ?? "HEALING",
        location: rest.location,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListWoundAssessmentsParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      surgicalProcedureId,
      from,
      to,
    } = params;
    return prisma.woundAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(surgicalProcedureId ? { surgicalProcedureId } : {}),
        ...(from || to
          ? {
              assessedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: assessmentSelect,
      orderBy: { assessedAt: "asc" },
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.woundAssessment.delete({ where: { id } });
  },
};
