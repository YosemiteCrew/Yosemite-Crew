import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class NeurologyAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "NeurologyAssessmentError";
  }
}

type ConsciousnessLevel = "ALERT" | "OBTUNDED" | "STUPOR" | "COMA";
type GaitScore =
  | "NORMAL"
  | "PARETIC"
  | "ATAXIC"
  | "NON_AMBULATORY_PARAPLEGIC"
  | "NON_AMBULATORY_TETRAPLEGIC";

export interface SpinalReflexGrades {
  [reflex: string]: "ABSENT" | "REDUCED" | "NORMAL" | "EXAGGERATED";
}

export interface CreateNeurologyParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  consciousnessLevel?: ConsciousnessLevel;
  gaitScore?: GaitScore;
  cranialNerveFindings?: string;
  spinalReflexGrades?: SpinalReflexGrades;
  deepPainPresent?: boolean;
  proprioceptionIntact?: boolean;
  seizureHistory?: boolean;
  seizureFrequency?: string;
  mriRecommended?: boolean;
  diagnoses?: string[];
  notes?: string;
}

export interface UpdateNeurologyParams {
  consciousnessLevel?: ConsciousnessLevel;
  gaitScore?: GaitScore;
  cranialNerveFindings?: string;
  spinalReflexGrades?: SpinalReflexGrades;
  deepPainPresent?: boolean;
  proprioceptionIntact?: boolean;
  seizureHistory?: boolean;
  seizureFrequency?: string;
  mriRecommended?: boolean;
  diagnoses?: string[];
  notes?: string;
}

export interface ListNeurologyParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  gaitScore?: GaitScore;
}

const neurologySelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  consciousnessLevel: true,
  gaitScore: true,
  cranialNerveFindings: true,
  spinalReflexGrades: true,
  deepPainPresent: true,
  proprioceptionIntact: true,
  seizureHistory: true,
  seizureFrequency: true,
  mriRecommended: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NeurologyAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.neurologyAssessment.findFirst({
    where: { id, organisationId },
    select: neurologySelect,
  });
  if (!record) {
    throw new NeurologyAssessmentError("Neurology assessment not found.", 404);
  }
  return record;
};

export const NeurologyAssessmentService = {
  async create(params: CreateNeurologyParams) {
    const {
      organisationId,
      patientId,
      assessedBy,
      spinalReflexGrades,
      ...rest
    } = params;

    const assessment = await prisma.neurologyAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        consciousnessLevel: rest.consciousnessLevel ?? null,
        gaitScore: rest.gaitScore ?? null,
        cranialNerveFindings: rest.cranialNerveFindings ?? null,
        spinalReflexGrades: spinalReflexGrades
          ? (spinalReflexGrades as unknown as Prisma.InputJsonValue)
          : undefined,
        deepPainPresent: rest.deepPainPresent ?? null,
        proprioceptionIntact: rest.proprioceptionIntact ?? null,
        seizureHistory: rest.seizureHistory ?? null,
        seizureFrequency: rest.seizureFrequency ?? null,
        mriRecommended: rest.mriRecommended ?? null,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: neurologySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "NEUROLOGY_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        consciousnessLevel: rest.consciousnessLevel ?? null,
        gaitScore: rest.gaitScore ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListNeurologyParams) {
    const { organisationId, patientId, encounterId, gaitScore } = params;
    return prisma.neurologyAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(gaitScore ? { gaitScore } : {}),
      },
      select: neurologySelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateNeurologyParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.NeurologyAssessmentUpdateInput = {};
    if (params.consciousnessLevel !== undefined)
      data.consciousnessLevel = params.consciousnessLevel;
    if (params.gaitScore !== undefined) data.gaitScore = params.gaitScore;
    if (params.cranialNerveFindings !== undefined)
      data.cranialNerveFindings = params.cranialNerveFindings;
    if (params.spinalReflexGrades !== undefined)
      data.spinalReflexGrades =
        params.spinalReflexGrades as unknown as Prisma.InputJsonValue;
    if (params.deepPainPresent !== undefined)
      data.deepPainPresent = params.deepPainPresent;
    if (params.proprioceptionIntact !== undefined)
      data.proprioceptionIntact = params.proprioceptionIntact;
    if (params.seizureHistory !== undefined)
      data.seizureHistory = params.seizureHistory;
    if (params.seizureFrequency !== undefined)
      data.seizureFrequency = params.seizureFrequency;
    if (params.mriRecommended !== undefined)
      data.mriRecommended = params.mriRecommended;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.neurologyAssessment.update({
      where: { id },
      data,
      select: neurologySelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.neurologyAssessment.delete({ where: { id } });
  },
};
