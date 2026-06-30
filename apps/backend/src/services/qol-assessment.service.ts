import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class QolAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "QolAssessmentError";
  }
}

export interface CreateQolParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  hhhhhmmScore?: number;
  painScore?: number;
  appetiteScore?: number;
  hygieneScore?: number;
  happinessScore?: number;
  mobilityScore?: number;
  moreDaysGood?: boolean;
  overallScore?: number;
  ownerAssessed?: boolean;
  clinicianNotes?: string;
  ownerNotes?: string;
  euthanasiaDiscussed?: boolean;
}

export type UpdateQolParams = Omit<
  CreateQolParams,
  "organisationId" | "patientId" | "assessedAt"
>;

export interface ListQolParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  ownerAssessed?: boolean;
}

const qolSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  hhhhhmmScore: true,
  painScore: true,
  appetiteScore: true,
  hygieneScore: true,
  happinessScore: true,
  mobilityScore: true,
  moreDaysGood: true,
  overallScore: true,
  ownerAssessed: true,
  clinicianNotes: true,
  ownerNotes: true,
  euthanasiaDiscussed: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QualityOfLifeAssessmentSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.qualityOfLifeAssessment.findFirst({
    where: { id, organisationId },
    select: qolSelect,
  });
  if (!record) {
    throw new QolAssessmentError("Quality-of-life assessment not found.", 404);
  }
  return record;
};

export const QolAssessmentService = {
  async create(params: CreateQolParams) {
    const { organisationId, patientId, assessedBy, ...rest } = params;

    const record = await prisma.qualityOfLifeAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        hhhhhmmScore: rest.hhhhhmmScore ?? null,
        painScore: rest.painScore ?? null,
        appetiteScore: rest.appetiteScore ?? null,
        hygieneScore: rest.hygieneScore ?? null,
        happinessScore: rest.happinessScore ?? null,
        mobilityScore: rest.mobilityScore ?? null,
        moreDaysGood: rest.moreDaysGood ?? null,
        overallScore: rest.overallScore ?? null,
        ownerAssessed: rest.ownerAssessed ?? false,
        clinicianNotes: rest.clinicianNotes ?? null,
        ownerNotes: rest.ownerNotes ?? null,
        euthanasiaDiscussed: rest.euthanasiaDiscussed ?? null,
      },
      select: qolSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "QOL_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        overallScore: rest.overallScore ?? null,
        hhhhhmmScore: rest.hhhhhmmScore ?? null,
        ownerAssessed: rest.ownerAssessed ?? false,
        euthanasiaDiscussed: rest.euthanasiaDiscussed ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListQolParams) {
    const { organisationId, patientId, encounterId, ownerAssessed } = params;
    return prisma.qualityOfLifeAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(ownerAssessed !== undefined ? { ownerAssessed } : {}),
      },
      select: qolSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdateQolParams) {
    await assertRecord(id, organisationId);

    const data: Prisma.QualityOfLifeAssessmentUpdateInput = {};
    if (params.assessedBy !== undefined) data.assessedBy = params.assessedBy;
    if (params.hhhhhmmScore !== undefined)
      data.hhhhhmmScore = params.hhhhhmmScore;
    if (params.painScore !== undefined) data.painScore = params.painScore;
    if (params.appetiteScore !== undefined)
      data.appetiteScore = params.appetiteScore;
    if (params.hygieneScore !== undefined)
      data.hygieneScore = params.hygieneScore;
    if (params.happinessScore !== undefined)
      data.happinessScore = params.happinessScore;
    if (params.mobilityScore !== undefined)
      data.mobilityScore = params.mobilityScore;
    if (params.moreDaysGood !== undefined)
      data.moreDaysGood = params.moreDaysGood;
    if (params.overallScore !== undefined)
      data.overallScore = params.overallScore;
    if (params.ownerAssessed !== undefined)
      data.ownerAssessed = params.ownerAssessed;
    if (params.clinicianNotes !== undefined)
      data.clinicianNotes = params.clinicianNotes;
    if (params.ownerNotes !== undefined) data.ownerNotes = params.ownerNotes;
    if (params.euthanasiaDiscussed !== undefined)
      data.euthanasiaDiscussed = params.euthanasiaDiscussed;

    return prisma.qualityOfLifeAssessment.update({
      where: { id },
      data,
      select: qolSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.qualityOfLifeAssessment.delete({ where: { id } });
  },
};
