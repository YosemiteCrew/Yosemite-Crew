import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class CardiologyAssessmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CardiologyAssessmentError";
  }
}

type HeartRhythm =
  | "NORMAL_SINUS"
  | "SINUS_ARRHYTHMIA"
  | "BRADYCARDIA"
  | "TACHYCARDIA"
  | "ATRIAL_FIBRILLATION"
  | "SECOND_DEGREE_AV_BLOCK"
  | "THIRD_DEGREE_AV_BLOCK"
  | "VENTRICULAR_PREMATURE_CONTRACTIONS"
  | "SUPRAVENTRICULAR_PREMATURE_CONTRACTIONS"
  | "OTHER";

type MurmurGrade =
  | "GRADE_1"
  | "GRADE_2"
  | "GRADE_3"
  | "GRADE_4"
  | "GRADE_5"
  | "GRADE_6";
type AcvimClass = "A" | "B1" | "B2" | "C" | "D";

export interface CreateCardiologyParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  assessedAt: Date;
  assessedBy?: string;
  heartRate?: number;
  heartRhythm?: HeartRhythm;
  murmurGrade?: MurmurGrade;
  murmurLocation?: string;
  murmurCharacter?: string;
  pulseQuality?: string;
  jugularPulse?: string;
  vertebralHeartScore?: number;
  laAoRatio?: number;
  fractionalShortening?: number;
  ejectionFraction?: number;
  acvimClass?: AcvimClass;
  findings?: Record<string, unknown>;
  diagnoses?: string[];
  notes?: string;
}

export interface UpdateCardiologyParams {
  heartRate?: number;
  heartRhythm?: HeartRhythm;
  murmurGrade?: MurmurGrade;
  murmurLocation?: string;
  murmurCharacter?: string;
  pulseQuality?: string;
  jugularPulse?: string;
  vertebralHeartScore?: number;
  laAoRatio?: number;
  fractionalShortening?: number;
  ejectionFraction?: number;
  acvimClass?: AcvimClass;
  findings?: Record<string, unknown>;
  diagnoses?: string[];
  notes?: string;
}

export interface ListCardiologyParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  acvimClass?: AcvimClass;
}

const cardioSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  assessedAt: true,
  assessedBy: true,
  heartRate: true,
  heartRhythm: true,
  murmurGrade: true,
  murmurLocation: true,
  murmurCharacter: true,
  pulseQuality: true,
  jugularPulse: true,
  vertebralHeartScore: true,
  laAoRatio: true,
  fractionalShortening: true,
  ejectionFraction: true,
  acvimClass: true,
  findings: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CardiologyAssessmentSelect;

const assertAssessment = async (id: string, organisationId: string) => {
  const record = await prisma.cardiologyAssessment.findFirst({
    where: { id, organisationId },
    select: cardioSelect,
  });
  if (!record) {
    throw new CardiologyAssessmentError(
      "Cardiology assessment not found.",
      404,
    );
  }
  return record;
};

export const CardiologyAssessmentService = {
  async create(params: CreateCardiologyParams) {
    const { organisationId, patientId, assessedBy, findings, ...rest } = params;

    const assessment = await prisma.cardiologyAssessment.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        assessedAt: rest.assessedAt,
        assessedBy: assessedBy ?? null,
        heartRate: rest.heartRate ?? null,
        heartRhythm: rest.heartRhythm ?? null,
        murmurGrade: rest.murmurGrade ?? null,
        murmurLocation: rest.murmurLocation ?? null,
        murmurCharacter: rest.murmurCharacter ?? null,
        pulseQuality: rest.pulseQuality ?? null,
        jugularPulse: rest.jugularPulse ?? null,
        vertebralHeartScore: rest.vertebralHeartScore ?? null,
        laAoRatio: rest.laAoRatio ?? null,
        fractionalShortening: rest.fractionalShortening ?? null,
        ejectionFraction: rest.ejectionFraction ?? null,
        acvimClass: rest.acvimClass ?? null,
        findings: findings
          ? (findings as unknown as Prisma.InputJsonValue)
          : undefined,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: cardioSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "CARDIOLOGY_ASSESSMENT_RECORDED",
      actorType: "PMS_USER",
      actorId: assessedBy ?? null,
      entityType: "COMPANION",
      entityId: assessment.id,
      metadata: {
        murmurGrade: rest.murmurGrade ?? null,
        acvimClass: rest.acvimClass ?? null,
      },
    });

    return assessment;
  },

  async get(id: string, organisationId: string) {
    return assertAssessment(id, organisationId);
  },

  async list(params: ListCardiologyParams) {
    const { organisationId, patientId, encounterId, acvimClass } = params;
    return prisma.cardiologyAssessment.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(acvimClass ? { acvimClass } : {}),
      },
      select: cardioSelect,
      orderBy: { assessedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateCardiologyParams,
  ) {
    await assertAssessment(id, organisationId);

    const data: Prisma.CardiologyAssessmentUpdateInput = {};
    if (params.heartRate !== undefined) data.heartRate = params.heartRate;
    if (params.heartRhythm !== undefined) data.heartRhythm = params.heartRhythm;
    if (params.murmurGrade !== undefined) data.murmurGrade = params.murmurGrade;
    if (params.murmurLocation !== undefined)
      data.murmurLocation = params.murmurLocation;
    if (params.murmurCharacter !== undefined)
      data.murmurCharacter = params.murmurCharacter;
    if (params.pulseQuality !== undefined)
      data.pulseQuality = params.pulseQuality;
    if (params.jugularPulse !== undefined)
      data.jugularPulse = params.jugularPulse;
    if (params.vertebralHeartScore !== undefined)
      data.vertebralHeartScore = params.vertebralHeartScore;
    if (params.laAoRatio !== undefined) data.laAoRatio = params.laAoRatio;
    if (params.fractionalShortening !== undefined)
      data.fractionalShortening = params.fractionalShortening;
    if (params.ejectionFraction !== undefined)
      data.ejectionFraction = params.ejectionFraction;
    if (params.acvimClass !== undefined) data.acvimClass = params.acvimClass;
    if (params.findings !== undefined)
      data.findings = params.findings as unknown as Prisma.InputJsonValue;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.cardiologyAssessment.update({
      where: { id },
      data,
      select: cardioSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertAssessment(id, organisationId);
    await prisma.cardiologyAssessment.delete({ where: { id } });
  },
};
