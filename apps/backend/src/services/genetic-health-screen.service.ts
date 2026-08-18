import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class GeneticHealthScreenError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "GeneticHealthScreenError";
  }
}

type OrthoRating =
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "BORDERLINE"
  | "MILD"
  | "MODERATE"
  | "SEVERE"
  | "NOT_EVALUABLE";

export interface DnaTestEntry {
  disease: string;
  gene?: string;
  result:
    | "CLEAR"
    | "CARRIER"
    | "AFFECTED"
    | "AFFECTED_MINOR"
    | "INCONCLUSIVE"
    | "PENDING";
  laboratoryId?: string;
}

export interface CreateGeneticScreenParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  screenedAt: Date;
  screenedBy?: string;
  laboratoryName?: string;
  dnaTests?: DnaTestEntry[];
  ofa_hips?: OrthoRating;
  ofa_elbows?: OrthoRating;
  ofa_patellas?: OrthoRating;
  ofa_cardiac?: string;
  ofa_eyes?: string;
  certificateNumber?: string;
  certificationExpiry?: Date;
  notes?: string;
}

export type UpdateGeneticScreenParams = Omit<
  CreateGeneticScreenParams,
  "organisationId" | "patientId" | "screenedAt"
>;

export interface ListGeneticScreenParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
}

const screenSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  screenedAt: true,
  screenedBy: true,
  laboratoryName: true,
  dnaTests: true,
  ofa_hips: true,
  ofa_elbows: true,
  ofa_patellas: true,
  ofa_cardiac: true,
  ofa_eyes: true,
  certificateNumber: true,
  certificationExpiry: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GeneticHealthScreenSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.geneticHealthScreen.findFirst({
    where: { id, organisationId },
    select: screenSelect,
  });
  if (!record) {
    throw new GeneticHealthScreenError("Genetic health screen not found.", 404);
  }
  return record;
};

export const GeneticHealthScreenService = {
  async create(params: CreateGeneticScreenParams) {
    const { organisationId, patientId, screenedBy, dnaTests, ...rest } = params;

    const record = await prisma.geneticHealthScreen.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        screenedAt: rest.screenedAt,
        screenedBy: screenedBy ?? null,
        laboratoryName: rest.laboratoryName ?? null,
        dnaTests: dnaTests
          ? (dnaTests as unknown as Prisma.InputJsonValue)
          : undefined,
        ofa_hips: rest.ofa_hips ?? null,
        ofa_elbows: rest.ofa_elbows ?? null,
        ofa_patellas: rest.ofa_patellas ?? null,
        ofa_cardiac: rest.ofa_cardiac ?? null,
        ofa_eyes: rest.ofa_eyes ?? null,
        certificateNumber: rest.certificateNumber ?? null,
        certificationExpiry: rest.certificationExpiry ?? null,
        notes: rest.notes ?? null,
      },
      select: screenSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "GENETIC_SCREEN_RECORDED",
      actorType: "PMS_USER",
      actorId: screenedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        laboratoryName: rest.laboratoryName ?? null,
        dnaTestCount: dnaTests?.length ?? 0,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListGeneticScreenParams) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.geneticHealthScreen.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: screenSelect,
      orderBy: { screenedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateGeneticScreenParams,
  ) {
    await assertRecord(id, organisationId);

    const data: Prisma.GeneticHealthScreenUpdateInput = {};
    if (params.screenedBy !== undefined) data.screenedBy = params.screenedBy;
    if (params.laboratoryName !== undefined)
      data.laboratoryName = params.laboratoryName;
    if (params.dnaTests !== undefined)
      data.dnaTests = params.dnaTests as unknown as Prisma.InputJsonValue;
    if (params.ofa_hips !== undefined) data.ofa_hips = params.ofa_hips;
    if (params.ofa_elbows !== undefined) data.ofa_elbows = params.ofa_elbows;
    if (params.ofa_patellas !== undefined)
      data.ofa_patellas = params.ofa_patellas;
    if (params.ofa_cardiac !== undefined) data.ofa_cardiac = params.ofa_cardiac;
    if (params.ofa_eyes !== undefined) data.ofa_eyes = params.ofa_eyes;
    if (params.certificateNumber !== undefined)
      data.certificateNumber = params.certificateNumber;
    if (params.certificationExpiry !== undefined)
      data.certificationExpiry = params.certificationExpiry;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.geneticHealthScreen.update({
      where: { id },
      data,
      select: screenSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertRecord(id, organisationId);
    await prisma.geneticHealthScreen.delete({ where: { id } });
  },
};
