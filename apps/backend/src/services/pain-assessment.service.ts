import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PainAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PainAssessmentError";
  }
}

type PainScale =
  | "NUMERIC_0_10"
  | "COLORADO_ACUTE_PAIN_SCALE"
  | "GLASGOW_COMPOSITE_PAIN_SCALE"
  | "UNESP_BOTUCATU"
  | "FELINE_GRIMACE_SCALE";

type PainInterventionType =
  | "ANALGESIC_GIVEN"
  | "REPOSITIONED"
  | "ICE_APPLIED"
  | "BANDAGE_ADJUSTED"
  | "ENVIRONMENT_MODIFIED"
  | "REASSESSED"
  | "OTHER";

export interface RecordPainAssessmentParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  painScale: PainScale;
  painScore: number;
  rawScore?: string;
  behaviouralSigns?: string;
  vocalisation?: boolean;
  posture?: string;
  assessedAt: Date;
  assessedBy?: string;
  interventionType?: PainInterventionType;
  interventionDetail?: string;
  reassessAt?: Date;
  notes?: string;
}

export interface ListPainAssessmentsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  from?: Date;
  to?: Date;
}

const assessmentSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  painScale: true,
  painScore: true,
  rawScore: true,
  behaviouralSigns: true,
  vocalisation: true,
  posture: true,
  assessedAt: true,
  assessedBy: true,
  interventionType: true,
  interventionDetail: true,
  reassessAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PainAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.painAssessment.findFirst({
    where: { id, organisationId },
    select: assessmentSelect,
  });
  if (!record) {
    throw new PainAssessmentError("Pain assessment not found.", 404);
  }
  return record;
};

export const PainAssessmentService = {
  async record(params: RecordPainAssessmentParams) {
    const { organisationId, patientId, assessedBy, reassessAt, ...rest } =
      params;

    const assessment = await prisma.painAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        painScale: rest.painScale,
        painScore: rest.painScore,
        rawScore: rest.rawScore ?? null,
        behaviouralSigns: rest.behaviouralSigns ?? null,
        vocalisation: rest.vocalisation ?? null,
        posture: rest.posture ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        interventionType: rest.interventionType ?? null,
        interventionDetail: rest.interventionDetail ?? null,
        reassessAt: reassessAt ?? null,
        notes: rest.notes ?? null,
      },
      select: assessmentSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PAIN_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        painScale: rest.painScale,
        painScore: rest.painScore,
        interventionType: rest.interventionType ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListPainAssessmentsParams) {
    const { organisationId, patientId, encounterId, from, to } = params;
    return prisma.painAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
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
    await prisma.painAssessment.delete({ where: { id } });
  },
};
