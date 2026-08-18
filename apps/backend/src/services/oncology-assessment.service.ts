import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class OncologyAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OncologyAssessmentError";
  }
}

type OncologyStage =
  | "STAGE_0"
  | "STAGE_I"
  | "STAGE_IA"
  | "STAGE_IB"
  | "STAGE_II"
  | "STAGE_IIA"
  | "STAGE_IIB"
  | "STAGE_III"
  | "STAGE_IIIA"
  | "STAGE_IIIB"
  | "STAGE_IV";

export interface CreateOncologyParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  tumorType?: string;
  primaryTumorStage?: string;
  nodeStage?: string;
  metastasisStage?: string;
  overallStage?: OncologyStage;
  chemotherapyProtocol?: string;
  chemotherapyStartDate?: Date;
  chemotherapyCycles?: number;
  qualityOfLifeScore?: number;
  prognosis?: string;
  diagnoses?: string[];
  notes?: string;
}

export type UpdateOncologyParams = Omit<
  CreateOncologyParams,
  "organisationId" | "patientId" | "assessedAt"
>;

export interface ListOncologyParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  overallStage?: OncologyStage;
}

const oncologySelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  tumorType: true,
  primaryTumorStage: true,
  nodeStage: true,
  metastasisStage: true,
  overallStage: true,
  chemotherapyProtocol: true,
  chemotherapyStartDate: true,
  chemotherapyCycles: true,
  qualityOfLifeScore: true,
  prognosis: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OncologyAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.oncologyAssessment.findFirst({
    where: { id, organisationId },
    select: oncologySelect,
  });
  if (!record) {
    throw new OncologyAssessmentError("Oncology assessment not found.", 404);
  }
  return record;
};

export const OncologyAssessmentService = {
  async create(params: CreateOncologyParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const assessment = await prisma.oncologyAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        tumorType: rest.tumorType ?? null,
        primaryTumorStage: rest.primaryTumorStage ?? null,
        nodeStage: rest.nodeStage ?? null,
        metastasisStage: rest.metastasisStage ?? null,
        overallStage: rest.overallStage ?? null,
        chemotherapyProtocol: rest.chemotherapyProtocol ?? null,
        chemotherapyStartDate: rest.chemotherapyStartDate ?? null,
        chemotherapyCycles: rest.chemotherapyCycles ?? null,
        qualityOfLifeScore: rest.qualityOfLifeScore ?? null,
        prognosis: rest.prognosis ?? null,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: oncologySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ONCOLOGY_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        tumorType: rest.tumorType ?? null,
        overallStage: rest.overallStage ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListOncologyParams) {
    const { organisationId, patientId, encounterId, overallStage } = params;
    return prisma.oncologyAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(overallStage ? { overallStage } : {}),
      },
      select: oncologySelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateOncologyParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.OncologyAssessmentUpdateInput = {};
    if (params.assessedBy !== undefined) data.assessedBy = params.assessedBy;
    if (params.tumorType !== undefined) data.tumorType = params.tumorType;
    if (params.primaryTumorStage !== undefined)
      data.primaryTumorStage = params.primaryTumorStage;
    if (params.nodeStage !== undefined) data.nodeStage = params.nodeStage;
    if (params.metastasisStage !== undefined)
      data.metastasisStage = params.metastasisStage;
    if (params.overallStage !== undefined)
      data.overallStage = params.overallStage;
    if (params.chemotherapyProtocol !== undefined)
      data.chemotherapyProtocol = params.chemotherapyProtocol;
    if (params.chemotherapyStartDate !== undefined)
      data.chemotherapyStartDate = params.chemotherapyStartDate;
    if (params.chemotherapyCycles !== undefined)
      data.chemotherapyCycles = params.chemotherapyCycles;
    if (params.qualityOfLifeScore !== undefined)
      data.qualityOfLifeScore = params.qualityOfLifeScore;
    if (params.prognosis !== undefined) data.prognosis = params.prognosis;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.oncologyAssessment.update({
      where: { id },
      data,
      select: oncologySelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.oncologyAssessment.delete({ where: { id } });
  },
};
