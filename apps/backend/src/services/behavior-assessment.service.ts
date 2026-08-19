import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class BehaviorAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BehaviorAssessmentError";
  }
}

type FasScore = "FAS_0" | "FAS_1" | "FAS_2" | "FAS_3" | "FAS_4" | "FAS_5";
type HandlingTolerance = "EASY" | "MODERATE" | "DIFFICULT" | "EXTREME";

export interface CreateBehaviorAssessmentParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  fasScore?: FasScore;
  nailTrimTolerance?: HandlingTolerance;
  handlingTolerance?: HandlingTolerance;
  aggressionTriggers?: string[];
  aversionBehaviors?: string[];
  trainingHistory?: string;
  diagnoses?: string[];
  referralRecommended?: boolean;
  fearFreeNotes?: string;
  notes?: string;
}

export interface UpdateBehaviorAssessmentParams {
  fasScore?: FasScore;
  nailTrimTolerance?: HandlingTolerance;
  handlingTolerance?: HandlingTolerance;
  aggressionTriggers?: string[];
  aversionBehaviors?: string[];
  trainingHistory?: string;
  diagnoses?: string[];
  referralRecommended?: boolean;
  fearFreeNotes?: string;
  notes?: string;
}

export interface ListBehaviorAssessmentParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  fasScore?: FasScore;
}

const behaviorSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  fasScore: true,
  nailTrimTolerance: true,
  handlingTolerance: true,
  aggressionTriggers: true,
  aversionBehaviors: true,
  trainingHistory: true,
  diagnoses: true,
  referralRecommended: true,
  fearFreeNotes: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BehaviorAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.behaviorAssessment.findFirst({
    where: { id, organisationId },
    select: behaviorSelect,
  });
  if (!record) {
    throw new BehaviorAssessmentError("Behavior assessment not found.", 404);
  }
  return record;
};

export const BehaviorAssessmentService = {
  async create(params: CreateBehaviorAssessmentParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const assessment = await prisma.behaviorAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        fasScore: rest.fasScore ?? null,
        nailTrimTolerance: rest.nailTrimTolerance ?? null,
        handlingTolerance: rest.handlingTolerance ?? null,
        aggressionTriggers: rest.aggressionTriggers ?? [],
        aversionBehaviors: rest.aversionBehaviors ?? [],
        trainingHistory: rest.trainingHistory ?? null,
        diagnoses: rest.diagnoses ?? [],
        referralRecommended: rest.referralRecommended ?? null,
        fearFreeNotes: rest.fearFreeNotes ?? null,
        notes: rest.notes ?? null,
      },
      select: behaviorSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "BEHAVIOR_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: { fasScore: rest.fasScore ?? null },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListBehaviorAssessmentParams) {
    const { organisationId, patientId, encounterId, fasScore } = params;
    return prisma.behaviorAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(fasScore ? { fasScore } : {}),
      },
      select: behaviorSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateBehaviorAssessmentParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.BehaviorAssessmentUpdateInput = {};
    if (params.fasScore !== undefined) data.fasScore = params.fasScore;
    if (params.nailTrimTolerance !== undefined)
      data.nailTrimTolerance = params.nailTrimTolerance;
    if (params.handlingTolerance !== undefined)
      data.handlingTolerance = params.handlingTolerance;
    if (params.aggressionTriggers !== undefined)
      data.aggressionTriggers = params.aggressionTriggers;
    if (params.aversionBehaviors !== undefined)
      data.aversionBehaviors = params.aversionBehaviors;
    if (params.trainingHistory !== undefined)
      data.trainingHistory = params.trainingHistory;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.referralRecommended !== undefined)
      data.referralRecommended = params.referralRecommended;
    if (params.fearFreeNotes !== undefined)
      data.fearFreeNotes = params.fearFreeNotes;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.behaviorAssessment.update({
      where: { id },
      data,
      select: behaviorSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.behaviorAssessment.delete({ where: { id } });
  },
};
