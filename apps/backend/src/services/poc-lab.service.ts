import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PocLabError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PocLabError";
  }
}

type PocTestType =
  | "CBC"
  | "BLOOD_CHEMISTRY"
  | "URINALYSIS"
  | "FECAL_FLOAT"
  | "CYTOLOGY"
  | "COAGULATION"
  | "ELECTROLYTES"
  | "THYROID_PANEL"
  | "CORTISOL"
  | "GLUCOSE_CURVE"
  | "BLOOD_GAS"
  | "OTHER";

export interface LabResultParameter {
  name: string;
  value: number | string;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  flag?: "H" | "L" | "HH" | "LL" | "N";
}

export interface CreatePocLabParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  conductedAt: Date;
  conductedBy?: string;
  testType: PocTestType;
  analyzerName?: string;
  sampleType?: string;
  results: LabResultParameter[];
  overallInterpretation?: string;
  abnormalFlags?: string[];
  criticalFlags?: string[];
  followUpRecommended?: boolean;
  notes?: string;
}

export interface UpdatePocLabParams {
  overallInterpretation?: string;
  abnormalFlags?: string[];
  criticalFlags?: string[];
  followUpRecommended?: boolean;
  notes?: string;
}

export interface ListPocLabParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  testType?: PocTestType;
}

const pocLabSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  conductedAt: true,
  conductedBy: true,
  testType: true,
  analyzerName: true,
  sampleType: true,
  results: true,
  overallInterpretation: true,
  abnormalFlags: true,
  criticalFlags: true,
  followUpRecommended: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PointOfCareLabSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.pointOfCareLab.findFirst({
    where: { id, organisationId },
    select: pocLabSelect,
  });
  if (!record) {
    throw new PocLabError("Point-of-care lab result not found.", 404);
  }
  return record;
};

export const PocLabService = {
  async create(params: CreatePocLabParams) {
    const { organisationId, patientId, conductedBy, results, ...rest } = params;

    const record = await prisma.pointOfCareLab.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        conductedAt: rest.conductedAt,
        conductedBy: conductedBy ?? null,
        testType: rest.testType,
        analyzerName: rest.analyzerName ?? null,
        sampleType: rest.sampleType ?? null,
        results: results as unknown as Prisma.InputJsonValue,
        overallInterpretation: rest.overallInterpretation ?? null,
        abnormalFlags: rest.abnormalFlags ?? [],
        criticalFlags: rest.criticalFlags ?? [],
        followUpRecommended: rest.followUpRecommended ?? null,
        notes: rest.notes ?? null,
      },
      select: pocLabSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "POC_LAB_RECORDED",
      actorType: "PMS_USER",
      actorId: conductedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        testType: rest.testType,
        criticalCount: (rest.criticalFlags ?? []).length,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListPocLabParams) {
    const { organisationId, patientId, encounterId, testType } = params;
    return prisma.pointOfCareLab.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(testType ? { testType } : {}),
      },
      select: pocLabSelect,
      orderBy: { conductedAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdatePocLabParams) {
    await assertRecord(id, organisationId);

    const data: Prisma.PointOfCareLabUpdateInput = {};
    if (params.overallInterpretation !== undefined)
      data.overallInterpretation = params.overallInterpretation;
    if (params.abnormalFlags !== undefined)
      data.abnormalFlags = params.abnormalFlags;
    if (params.criticalFlags !== undefined)
      data.criticalFlags = params.criticalFlags;
    if (params.followUpRecommended !== undefined)
      data.followUpRecommended = params.followUpRecommended;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.pointOfCareLab.update({
      where: { id },
      data,
      select: pocLabSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.pointOfCareLab.delete({ where: { id } });
  },
};
