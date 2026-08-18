import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class DermatologyAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DermatologyAssessmentError";
  }
}

export interface LesionMapRegion {
  region: string;
  lesions: string[];
  severity?: "MILD" | "MODERATE" | "SEVERE";
}

export interface CreateDermatologyParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  pruritusScore?: number;
  affectedRegions?: string[];
  primaryLesions?: string[];
  secondaryLesions?: string[];
  coatQuality?: string;
  lesionMap?: LesionMapRegion[];
  environmentalAllergens?: string[];
  foodTrialStatus?: string;
  cades04Score?: number;
  diagnoses?: string[];
  notes?: string;
}

export interface UpdateDermatologyParams {
  pruritusScore?: number;
  affectedRegions?: string[];
  primaryLesions?: string[];
  secondaryLesions?: string[];
  coatQuality?: string;
  lesionMap?: LesionMapRegion[];
  environmentalAllergens?: string[];
  foodTrialStatus?: string;
  cades04Score?: number;
  diagnoses?: string[];
  notes?: string;
}

export interface ListDermatologyParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
}

const dermaSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  pruritusScore: true,
  affectedRegions: true,
  primaryLesions: true,
  secondaryLesions: true,
  coatQuality: true,
  lesionMap: true,
  environmentalAllergens: true,
  foodTrialStatus: true,
  cades04Score: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DermatologyAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.dermatologyAssessment.findFirst({
    where: { id, organisationId },
    select: dermaSelect,
  });
  if (!record) {
    throw new DermatologyAssessmentError(
      "Dermatology assessment not found.",
      404,
    );
  }
  return record;
};

export const DermatologyAssessmentService = {
  async create(params: CreateDermatologyParams) {
    const { organisationId, patientId, assessedBy, lesionMap, ...rest } =
      params;

    const assessment = await prisma.dermatologyAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        pruritusScore: rest.pruritusScore ?? null,
        affectedRegions: rest.affectedRegions ?? [],
        primaryLesions: rest.primaryLesions ?? [],
        secondaryLesions: rest.secondaryLesions ?? [],
        coatQuality: rest.coatQuality ?? null,
        lesionMap: lesionMap
          ? (lesionMap as unknown as Prisma.InputJsonValue)
          : undefined,
        environmentalAllergens: rest.environmentalAllergens ?? [],
        foodTrialStatus: rest.foodTrialStatus ?? null,
        cades04Score: rest.cades04Score ?? null,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: dermaSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "DERMATOLOGY_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        pruritusScore: rest.pruritusScore ?? null,
        cades04Score: rest.cades04Score ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListDermatologyParams) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.dermatologyAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: dermaSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateDermatologyParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.DermatologyAssessmentUpdateInput = {};
    if (params.pruritusScore !== undefined)
      data.pruritusScore = params.pruritusScore;
    if (params.affectedRegions !== undefined)
      data.affectedRegions = params.affectedRegions;
    if (params.primaryLesions !== undefined)
      data.primaryLesions = params.primaryLesions;
    if (params.secondaryLesions !== undefined)
      data.secondaryLesions = params.secondaryLesions;
    if (params.coatQuality !== undefined) data.coatQuality = params.coatQuality;
    if (params.lesionMap !== undefined)
      data.lesionMap = params.lesionMap as unknown as Prisma.InputJsonValue;
    if (params.environmentalAllergens !== undefined)
      data.environmentalAllergens = params.environmentalAllergens;
    if (params.foodTrialStatus !== undefined)
      data.foodTrialStatus = params.foodTrialStatus;
    if (params.cades04Score !== undefined)
      data.cades04Score = params.cades04Score;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.dermatologyAssessment.update({
      where: { id },
      data,
      select: dermaSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.dermatologyAssessment.delete({ where: { id } });
  },
};
