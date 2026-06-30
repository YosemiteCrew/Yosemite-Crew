import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class OphthalmologyExaminationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OphthalmologyExaminationError";
  }
}

type VisionStatus = "NORMAL" | "REDUCED" | "ABSENT" | "UNKNOWN";
type PLRResponse = "NORMAL" | "SLUGGISH" | "ABSENT";

export interface EyeFinding {
  discharge?: "ABSENT" | "SEROUS" | "MUCOID" | "PURULENT" | "HAEMORRHAGIC";
  cornealClarity?: "CLEAR" | "HAZE" | "OEDEMA" | "ULCER" | "OPACITY";
  lensClarity?:
    | "CLEAR"
    | "EARLY_CATARACT"
    | "MATURE_CATARACT"
    | "HYPERMATURE_CATARACT";
  vitreousClarity?: "CLEAR" | "HAZE" | "HAEMORRHAGE" | "FLOATERS";
  retina?:
    | "NORMAL"
    | "DETACHED"
    | "DEGENERATIVE"
    | "HAEMORRHAGE"
    | "PAPILLOEDEMA";
  conjunctiva?: "NORMAL" | "HYPERAEMIC" | "CHEMOSIS" | "FOLLICLES";
  notes?: string;
}

export interface CreateOphthExamParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  examinedAt: Date;
  examinedBy?: string;
  visionLeft?: VisionStatus;
  visionRight?: VisionStatus;
  menaceLeft?: boolean;
  menaceRight?: boolean;
  plrDirectLeft?: PLRResponse;
  plrDirectRight?: PLRResponse;
  plrConsensualLeft?: PLRResponse;
  plrConsensualRight?: PLRResponse;
  sttLeft?: number;
  sttRight?: number;
  iopLeft?: number;
  iopRight?: number;
  fluoresceinLeft?: boolean;
  fluoresceinRight?: boolean;
  findingsLeft?: EyeFinding;
  findingsRight?: EyeFinding;
  diagnoses?: string[];
  notes?: string;
}

export interface UpdateOphthExamParams {
  visionLeft?: VisionStatus;
  visionRight?: VisionStatus;
  menaceLeft?: boolean;
  menaceRight?: boolean;
  plrDirectLeft?: PLRResponse;
  plrDirectRight?: PLRResponse;
  plrConsensualLeft?: PLRResponse;
  plrConsensualRight?: PLRResponse;
  sttLeft?: number;
  sttRight?: number;
  iopLeft?: number;
  iopRight?: number;
  fluoresceinLeft?: boolean;
  fluoresceinRight?: boolean;
  findingsLeft?: EyeFinding;
  findingsRight?: EyeFinding;
  diagnoses?: string[];
  notes?: string;
}

export interface ListOphthExamParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
}

const ophthSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  examinedAt: true,
  examinedBy: true,
  visionLeft: true,
  visionRight: true,
  menaceLeft: true,
  menaceRight: true,
  plrDirectLeft: true,
  plrDirectRight: true,
  plrConsensualLeft: true,
  plrConsensualRight: true,
  sttLeft: true,
  sttRight: true,
  iopLeft: true,
  iopRight: true,
  fluoresceinLeft: true,
  fluoresceinRight: true,
  findingsLeft: true,
  findingsRight: true,
  diagnoses: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OphthalmologyExaminationSelect;

const assertExam = async (id: string, organisationId: string) => {
  const record = await prisma.ophthalmologyExamination.findFirst({
    where: { id, organisationId },
    select: ophthSelect,
  });
  if (!record) {
    throw new OphthalmologyExaminationError(
      "Ophthalmology examination not found.",
      404,
    );
  }
  return record;
};

export const OphthalmologyExaminationService = {
  async create(params: CreateOphthExamParams) {
    const {
      organisationId,
      patientId,
      examinedBy,
      findingsLeft,
      findingsRight,
      ...rest
    } = params;

    const exam = await prisma.ophthalmologyExamination.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        examinedAt: rest.examinedAt,
        examinedBy: examinedBy ?? null,
        visionLeft: rest.visionLeft ?? null,
        visionRight: rest.visionRight ?? null,
        menaceLeft: rest.menaceLeft ?? null,
        menaceRight: rest.menaceRight ?? null,
        plrDirectLeft: rest.plrDirectLeft ?? null,
        plrDirectRight: rest.plrDirectRight ?? null,
        plrConsensualLeft: rest.plrConsensualLeft ?? null,
        plrConsensualRight: rest.plrConsensualRight ?? null,
        sttLeft: rest.sttLeft ?? null,
        sttRight: rest.sttRight ?? null,
        iopLeft: rest.iopLeft ?? null,
        iopRight: rest.iopRight ?? null,
        fluoresceinLeft: rest.fluoresceinLeft ?? null,
        fluoresceinRight: rest.fluoresceinRight ?? null,
        findingsLeft: findingsLeft
          ? (findingsLeft as unknown as Prisma.InputJsonValue)
          : undefined,
        findingsRight: findingsRight
          ? (findingsRight as unknown as Prisma.InputJsonValue)
          : undefined,
        diagnoses: rest.diagnoses ?? [],
        notes: rest.notes ?? null,
      },
      select: ophthSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "OPHTHALMOLOGY_EXAMINATION_RECORDED",
      actorType: "PMS_USER",
      actorId: examinedBy ?? null,
      entityType: "COMPANION",
      entityId: exam.id,
      metadata: { diagnosisCount: (rest.diagnoses ?? []).length },
    });

    return exam;
  },

  async get(id: string, organisationId: string) {
    return assertExam(id, organisationId);
  },

  async list(params: ListOphthExamParams) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.ophthalmologyExamination.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: ophthSelect,
      orderBy: { examinedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateOphthExamParams,
  ) {
    await assertExam(id, organisationId);

    const data: Prisma.OphthalmologyExaminationUpdateInput = {};
    if (params.visionLeft !== undefined) data.visionLeft = params.visionLeft;
    if (params.visionRight !== undefined) data.visionRight = params.visionRight;
    if (params.menaceLeft !== undefined) data.menaceLeft = params.menaceLeft;
    if (params.menaceRight !== undefined) data.menaceRight = params.menaceRight;
    if (params.plrDirectLeft !== undefined)
      data.plrDirectLeft = params.plrDirectLeft;
    if (params.plrDirectRight !== undefined)
      data.plrDirectRight = params.plrDirectRight;
    if (params.plrConsensualLeft !== undefined)
      data.plrConsensualLeft = params.plrConsensualLeft;
    if (params.plrConsensualRight !== undefined)
      data.plrConsensualRight = params.plrConsensualRight;
    if (params.sttLeft !== undefined) data.sttLeft = params.sttLeft;
    if (params.sttRight !== undefined) data.sttRight = params.sttRight;
    if (params.iopLeft !== undefined) data.iopLeft = params.iopLeft;
    if (params.iopRight !== undefined) data.iopRight = params.iopRight;
    if (params.fluoresceinLeft !== undefined)
      data.fluoresceinLeft = params.fluoresceinLeft;
    if (params.fluoresceinRight !== undefined)
      data.fluoresceinRight = params.fluoresceinRight;
    if (params.findingsLeft !== undefined)
      data.findingsLeft =
        params.findingsLeft as unknown as Prisma.InputJsonValue;
    if (params.findingsRight !== undefined)
      data.findingsRight =
        params.findingsRight as unknown as Prisma.InputJsonValue;
    if (params.diagnoses !== undefined) data.diagnoses = params.diagnoses;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.ophthalmologyExamination.update({
      where: { id },
      data,
      select: ophthSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertExam(id, organisationId);
    await prisma.ophthalmologyExamination.delete({ where: { id } });
  },
};
