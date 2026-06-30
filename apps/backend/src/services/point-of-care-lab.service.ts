import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PointOfCareLabError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PointOfCareLabError";
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

export interface CreatePocLabParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  conductedAt: Date;
  conductedBy?: string;
  testType: PocTestType;
  analyzerName?: string;
  sampleType?: string;
  results: Record<string, unknown>;
  overallInterpretation?: string;
  abnormalFlags?: string[];
  criticalFlags?: string[];
  followUpRecommended?: boolean;
  notes?: string;
}

const pocSelect = {
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
    select: pocSelect,
  });
  if (!record) throw new PointOfCareLabError("POC lab result not found.", 404);
  return record;
};

export const PointOfCareLabService = {
  async create(params: CreatePocLabParams) {
    const record = await prisma.pointOfCareLab.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        conductedAt: params.conductedAt,
        conductedBy: params.conductedBy ?? null,
        testType: params.testType,
        analyzerName: params.analyzerName ?? null,
        sampleType: params.sampleType ?? null,
        results: params.results as Prisma.InputJsonValue,
        overallInterpretation: params.overallInterpretation ?? null,
        abnormalFlags: params.abnormalFlags ?? [],
        criticalFlags: params.criticalFlags ?? [],
        followUpRecommended: params.followUpRecommended ?? null,
        notes: params.notes ?? null,
      },
      select: pocSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "POC_LAB_RECORDED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        testType: params.testType,
        criticalFlags: params.criticalFlags?.length ?? 0,
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
    testType?: PocTestType;
    hasCriticalFlags?: boolean;
  }) {
    const {
      organisationId,
      patientId,
      encounterId,
      testType,
      hasCriticalFlags,
    } = params;
    return prisma.pointOfCareLab.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(testType ? { testType } : {}),
        ...(hasCriticalFlags === true
          ? { criticalFlags: { isEmpty: false } }
          : {}),
        ...(hasCriticalFlags === false
          ? { criticalFlags: { isEmpty: true } }
          : {}),
      },
      select: pocSelect,
      orderBy: { conductedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: {
      overallInterpretation?: string;
      followUpRecommended?: boolean;
      notes?: string;
    },
  ) {
    await assertRecord(id, organisationId);
    return prisma.pointOfCareLab.update({
      where: { id },
      data: {
        ...(params.overallInterpretation !== undefined
          ? { overallInterpretation: params.overallInterpretation }
          : {}),
        ...(params.followUpRecommended !== undefined
          ? { followUpRecommended: params.followUpRecommended }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
      },
      select: pocSelect,
    });
  },
};
