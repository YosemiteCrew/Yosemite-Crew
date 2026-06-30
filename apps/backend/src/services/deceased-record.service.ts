import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class DeceasedRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeceasedRecordError";
  }
}

type CauseOfDeathType =
  | "EUTHANASIA"
  | "NATURAL_DEATH"
  | "TRAUMATIC_INJURY"
  | "ACUTE_ILLNESS"
  | "CHRONIC_DISEASE"
  | "SURGICAL_COMPLICATION"
  | "ANESTHETIC_COMPLICATION"
  | "UNKNOWN"
  | "OTHER";

type BodyDispositionType =
  | "OWNER_COLLECTED"
  | "PRIVATE_CREMATION"
  | "COMMUNAL_CREMATION"
  | "AQUAMATION"
  | "BURIAL"
  | "NECROPSY_FACILITY"
  | "DONATED_TO_SCIENCE";

export interface CreateDeceasedRecordParams {
  organisationId: string;
  patientId: string;
  deceasedAt: Date;
  causeOfDeathType: CauseOfDeathType;
  causeOfDeathDetail?: string;
  bodyWeightKg?: number;
  bodyConditionScore?: number;
  necropsyRequested?: boolean;
  necropsyFacility?: string;
  bodyDisposition?: BodyDispositionType;
  ownerNotifiedAt?: Date;
  certifiedBy?: string;
  notes?: string;
  recordedBy?: string;
}

export type UpdateDeceasedRecordParams = Partial<
  Omit<
    CreateDeceasedRecordParams,
    "organisationId" | "patientId" | "recordedBy"
  >
>;

const deceasedRecordSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  deceasedAt: true,
  causeOfDeathType: true,
  causeOfDeathDetail: true,
  bodyWeightKg: true,
  bodyConditionScore: true,
  necropsyRequested: true,
  necropsyFacility: true,
  bodyDisposition: true,
  ownerNotifiedAt: true,
  certifiedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeceasedRecordSelect;

const assertDeceasedRecord = async (id: string, organisationId: string) => {
  const record = await prisma.deceasedRecord.findFirst({
    where: { id, organisationId },
    select: deceasedRecordSelect,
  });
  if (!record) {
    throw new DeceasedRecordError("Deceased record not found.", 404);
  }
  return record;
};

export const DeceasedRecordService = {
  async create(params: CreateDeceasedRecordParams) {
    const { organisationId, patientId, recordedBy, ...rest } = params;

    const existing = await prisma.deceasedRecord.findUnique({
      where: { patientId },
      select: { id: true },
    });
    if (existing) {
      throw new DeceasedRecordError(
        "A deceased record already exists for this patient.",
        409,
      );
    }

    const record = await prisma.deceasedRecord.create({
      data: {
        organisationId,
        patientId,
        deceasedAt: rest.deceasedAt,
        causeOfDeathType: rest.causeOfDeathType,
        causeOfDeathDetail: rest.causeOfDeathDetail ?? null,
        bodyWeightKg: rest.bodyWeightKg ?? null,
        bodyConditionScore: rest.bodyConditionScore ?? null,
        necropsyRequested: rest.necropsyRequested ?? false,
        necropsyFacility: rest.necropsyFacility ?? null,
        bodyDisposition: rest.bodyDisposition ?? null,
        ownerNotifiedAt: rest.ownerNotifiedAt ?? null,
        certifiedBy: rest.certifiedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: deceasedRecordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "DECEASED_RECORD_CREATED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        causeOfDeathType: rest.causeOfDeathType,
        deceasedAt: rest.deceasedAt.toISOString(),
      },
    });

    return record;
  },

  async getByPatient(patientId: string, organisationId: string) {
    const record = await prisma.deceasedRecord.findFirst({
      where: { patientId, organisationId },
      select: deceasedRecordSelect,
    });
    if (!record) {
      throw new DeceasedRecordError("Deceased record not found.", 404);
    }
    return record;
  },

  async get(id: string, organisationId: string) {
    return assertDeceasedRecord(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    causeOfDeathType?: CauseOfDeathType;
  }) {
    const { organisationId, causeOfDeathType } = params;
    return prisma.deceasedRecord.findMany({
      where: {
        organisationId,
        ...(causeOfDeathType ? { causeOfDeathType } : {}),
      },
      select: deceasedRecordSelect,
      orderBy: { deceasedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateDeceasedRecordParams,
  ) {
    await assertDeceasedRecord(id, organisationId);

    const data: Prisma.DeceasedRecordUpdateInput = {};
    if (params.deceasedAt !== undefined) data.deceasedAt = params.deceasedAt;
    if (params.causeOfDeathType !== undefined)
      data.causeOfDeathType = params.causeOfDeathType;
    if (params.causeOfDeathDetail !== undefined)
      data.causeOfDeathDetail = params.causeOfDeathDetail;
    if (params.bodyWeightKg !== undefined)
      data.bodyWeightKg = params.bodyWeightKg;
    if (params.bodyConditionScore !== undefined)
      data.bodyConditionScore = params.bodyConditionScore;
    if (params.necropsyRequested !== undefined)
      data.necropsyRequested = params.necropsyRequested;
    if (params.necropsyFacility !== undefined)
      data.necropsyFacility = params.necropsyFacility;
    if (params.bodyDisposition !== undefined)
      data.bodyDisposition = params.bodyDisposition;
    if (params.ownerNotifiedAt !== undefined)
      data.ownerNotifiedAt = params.ownerNotifiedAt;
    if (params.certifiedBy !== undefined) data.certifiedBy = params.certifiedBy;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.deceasedRecord.update({
      where: { id },
      data,
      select: deceasedRecordSelect,
    });
  },
};
