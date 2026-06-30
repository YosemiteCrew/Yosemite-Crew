import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class QualityOfLifeAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "QualityOfLifeAssessmentError";
  }
}

export interface CreateQolAssessmentParams {
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

const assertAssessment = async (id: string, organisationId: string) => {
  const assessment = await prisma.qualityOfLifeAssessment.findFirst({
    where: { id, organisationId },
    select: qolSelect,
  });
  if (!assessment) {
    throw new QualityOfLifeAssessmentError(
      "Quality of life assessment not found.",
      404,
    );
  }
  return assessment;
};

export const QualityOfLifeAssessmentService = {
  async create(params: CreateQolAssessmentParams) {
    const assessment = await prisma.qualityOfLifeAssessment.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        assessedAt: params.assessedAt,
        assessedBy: params.assessedBy ?? null,
        hhhhhmmScore: params.hhhhhmmScore ?? null,
        painScore: params.painScore ?? null,
        appetiteScore: params.appetiteScore ?? null,
        hygieneScore: params.hygieneScore ?? null,
        happinessScore: params.happinessScore ?? null,
        mobilityScore: params.mobilityScore ?? null,
        moreDaysGood: params.moreDaysGood ?? null,
        overallScore: params.overallScore ?? null,
        ownerAssessed: params.ownerAssessed ?? false,
        clinicianNotes: params.clinicianNotes ?? null,
        ownerNotes: params.ownerNotes ?? null,
        euthanasiaDiscussed: params.euthanasiaDiscussed ?? null,
      },
      select: qolSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "QUALITY_OF_LIFE_ASSESSED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        overallScore: params.overallScore,
        euthanasiaDiscussed: params.euthanasiaDiscussed,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    encounterId?: string;
  }) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.qualityOfLifeAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: qolSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async trend(patientId: string, organisationId: string, limit = 20) {
    return prisma.qualityOfLifeAssessment.findMany({
      where: { patientId, organisationId },
      select: qolSelect,
      orderBy: { assessedAt: "asc" },
      take: limit,
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: Partial<
      Omit<CreateQolAssessmentParams, "organisationId" | "patientId">
    >,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.QualityOfLifeAssessmentUpdateInput = {};
    if (params.encounterId !== undefined) data.encounterId = params.encounterId;
    if (params.assessedAt !== undefined) data.assessedAt = params.assessedAt;
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
};
