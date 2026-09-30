import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { assertPatientOrgMembership } from "./shared/patient-org-membership";
import type { Prisma } from "@prisma/client";

export class DentalExaminationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DentalExaminationError";
  }
}

type DentalGrade = "GRADE_0" | "GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4";

export interface ToothFinding {
  tooth: string;
  condition?:
    | "NORMAL"
    | "FRACTURE"
    | "MISSING"
    | "EXTRACTED"
    | "SUPERNUMERARY"
    | "PERSISTENT_DECIDUOUS"
    | "GINGIVITIS"
    | "PERIODONTITIS"
    | "TOOTH_RESORPTION"
    | "NEOPLASIA"
    | "OTHER";
  mobilityGrade?: "GRADE_0" | "GRADE_1" | "GRADE_2" | "GRADE_3";
  calculus?: number;
  periodontalDepth?: number;
  notes?: string;
}

export interface CreateDentalExamParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  examinedAt: Date;
  examinedBy?: string;
  overallGrade: DentalGrade;
  findings: ToothFinding[];
  calculusScore?: number;
  plaqueScore?: number;
  gingivalScore?: number;
  procedures?: string[];
  notes?: string;
}

export interface UpdateDentalExamParams {
  overallGrade?: DentalGrade;
  findings?: ToothFinding[];
  calculusScore?: number | null;
  plaqueScore?: number | null;
  gingivalScore?: number | null;
  procedures?: string[];
  notes?: string | null;
}

export interface ListDentalExamParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
}

const dentalSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  examinedAt: true,
  examinedBy: true,
  overallGrade: true,
  findings: true,
  calculusScore: true,
  plaqueScore: true,
  gingivalScore: true,
  procedures: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DentalExaminationSelect;

const assertExam = async (id: string, organisationId: string) => {
  const record = await prisma.dentalExamination.findFirst({
    where: { id, organisationId },
    select: dentalSelect,
  });
  if (!record) {
    throw new DentalExaminationError("Dental examination not found.", 404);
  }
  return record;
};

/**
 * DentalExamination carries bare patientId/encounterId columns, so a body naming
 * another tenant's companion or visit would be stored as-is. The encounter must
 * also belong to the same patient, or the chart would surface on the wrong visit.
 * Uniform 404s so this cannot be used to probe which ids exist.
 */
const assertExamTargets = async (
  patientId: string,
  organisationId: string,
  encounterId?: string,
) => {
  await assertPatientOrgMembership(patientId, organisationId, () => {
    throw new DentalExaminationError("Companion not found.", 404);
  });
  if (!encounterId) return;
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, organisationId, patientId },
    select: { id: true },
  });
  if (!encounter) {
    throw new DentalExaminationError("Encounter not found.", 404);
  }
};

export const DentalExaminationService = {
  async create(params: CreateDentalExamParams) {
    const {
      organisationId,
      patientId,
      examinedBy,
      findings,
      procedures,
      ...rest
    } = params;

    await assertExamTargets(patientId, organisationId, rest.encounterId);

    const exam = await prisma.dentalExamination.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        examinedAt: rest.examinedAt,
        examinedBy: examinedBy ?? null,
        overallGrade: rest.overallGrade,
        findings: findings as unknown as Prisma.InputJsonValue,
        calculusScore: rest.calculusScore ?? null,
        plaqueScore: rest.plaqueScore ?? null,
        gingivalScore: rest.gingivalScore ?? null,
        procedures: procedures ?? [],
        notes: rest.notes ?? null,
      },
      select: dentalSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "DENTAL_EXAMINATION_RECORDED",
      actorType: "PMS_USER",
      actorId: examinedBy ?? null,
      entityType: "COMPANION",
      entityId: exam.id,
      metadata: {
        overallGrade: rest.overallGrade,
        toothCount: findings.length,
      },
    });

    return exam;
  },

  async get(id: string, organisationId: string) {
    return assertExam(id, organisationId);
  },

  async list(params: ListDentalExamParams) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.dentalExamination.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: dentalSelect,
      orderBy: { examinedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateDentalExamParams,
  ) {
    await assertExam(id, organisationId);

    const data: Prisma.DentalExaminationUpdateInput = {};
    if (params.overallGrade !== undefined)
      data.overallGrade = params.overallGrade;
    if (params.findings !== undefined)
      data.findings = params.findings as unknown as Prisma.InputJsonValue;
    if (params.calculusScore !== undefined)
      data.calculusScore = params.calculusScore;
    if (params.plaqueScore !== undefined) data.plaqueScore = params.plaqueScore;
    if (params.gingivalScore !== undefined)
      data.gingivalScore = params.gingivalScore;
    if (params.procedures !== undefined) data.procedures = params.procedures;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.dentalExamination.update({
      where: { id },
      data,
      select: dentalSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertExam(id, organisationId);
    await prisma.dentalExamination.delete({ where: { id } });
  },
};
