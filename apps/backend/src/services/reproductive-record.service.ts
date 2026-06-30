import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ReproductiveRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ReproductiveRecordError";
  }
}

type ReproductiveStatus =
  | "INTACT"
  | "SPAYED"
  | "NEUTERED"
  | "CASTRATED"
  | "UNKNOWN";
type PregnancyStatus =
  | "SUSPECTED"
  | "CONFIRMED"
  | "WHELPED"
  | "QUEENED"
  | "ABORTED"
  | "RESORBED";

export interface CreateReproductiveRecordParams {
  organisationId: string;
  patientId: string;
  reproductiveStatus: ReproductiveStatus;
  lastHeatDate?: Date;
  nextHeatExpected?: Date;
  matingDate?: Date;
  sireId?: string;
  sireName?: string;
  pregnancyStatus?: PregnancyStatus;
  pregnancyConfirmedAt?: Date;
  expectedWhelp?: Date;
  litterSizeUltrasound?: number;
  litterSizeXray?: number;
  actualWhelp?: Date;
  litterSizeBorn?: number;
  litterSizeAlive?: number;
  recordedBy?: string;
  notes?: string;
}

export interface UpdateReproductiveRecordParams {
  reproductiveStatus?: ReproductiveStatus;
  lastHeatDate?: Date;
  nextHeatExpected?: Date;
  matingDate?: Date;
  sireId?: string;
  sireName?: string;
  pregnancyStatus?: PregnancyStatus;
  pregnancyConfirmedAt?: Date;
  expectedWhelp?: Date;
  litterSizeUltrasound?: number;
  litterSizeXray?: number;
  actualWhelp?: Date;
  litterSizeBorn?: number;
  litterSizeAlive?: number;
  notes?: string;
}

export interface ListReproductiveRecordsParams {
  organisationId: string;
  patientId?: string;
  reproductiveStatus?: ReproductiveStatus;
}

const repSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  reproductiveStatus: true,
  lastHeatDate: true,
  nextHeatExpected: true,
  matingDate: true,
  sireId: true,
  sireName: true,
  pregnancyStatus: true,
  pregnancyConfirmedAt: true,
  expectedWhelp: true,
  litterSizeUltrasound: true,
  litterSizeXray: true,
  actualWhelp: true,
  litterSizeBorn: true,
  litterSizeAlive: true,
  recordedBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReproductiveRecordSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.reproductiveRecord.findFirst({
    where: { id, organisationId },
    select: repSelect,
  });
  if (!record) {
    throw new ReproductiveRecordError("Reproductive record not found.", 404);
  }
  return record;
};

export const ReproductiveRecordService = {
  async create(params: CreateReproductiveRecordParams) {
    const { organisationId, patientId, recordedBy, ...rest } = params;

    const record = await prisma.reproductiveRecord.create({
      data: {
        organisationId,
        patientId,
        reproductiveStatus: rest.reproductiveStatus,
        lastHeatDate: rest.lastHeatDate ?? null,
        nextHeatExpected: rest.nextHeatExpected ?? null,
        matingDate: rest.matingDate ?? null,
        sireId: rest.sireId ?? null,
        sireName: rest.sireName ?? null,
        pregnancyStatus: rest.pregnancyStatus ?? null,
        pregnancyConfirmedAt: rest.pregnancyConfirmedAt ?? null,
        expectedWhelp: rest.expectedWhelp ?? null,
        litterSizeUltrasound: rest.litterSizeUltrasound ?? null,
        litterSizeXray: rest.litterSizeXray ?? null,
        actualWhelp: rest.actualWhelp ?? null,
        litterSizeBorn: rest.litterSizeBorn ?? null,
        litterSizeAlive: rest.litterSizeAlive ?? null,
        recordedBy: recordedBy ?? null,
        notes: rest.notes ?? null,
      },
      select: repSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "REPRODUCTIVE_RECORD_CREATED",
      actorType: "PMS_USER",
      actorId: recordedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        reproductiveStatus: rest.reproductiveStatus,
        pregnancyStatus: rest.pregnancyStatus ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListReproductiveRecordsParams) {
    const { organisationId, patientId, reproductiveStatus } = params;
    return prisma.reproductiveRecord.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(reproductiveStatus ? { reproductiveStatus } : {}),
      },
      select: repSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateReproductiveRecordParams,
    updatedBy?: string,
  ) {
    const existing = await assertRecord(id, organisationId);

    const data: Prisma.ReproductiveRecordUpdateInput = {};
    if (params.reproductiveStatus !== undefined)
      data.reproductiveStatus = params.reproductiveStatus;
    if (params.lastHeatDate !== undefined)
      data.lastHeatDate = params.lastHeatDate;
    if (params.nextHeatExpected !== undefined)
      data.nextHeatExpected = params.nextHeatExpected;
    if (params.matingDate !== undefined) data.matingDate = params.matingDate;
    if (params.sireId !== undefined) data.sireId = params.sireId;
    if (params.sireName !== undefined) data.sireName = params.sireName;
    if (params.pregnancyStatus !== undefined)
      data.pregnancyStatus = params.pregnancyStatus;
    if (params.pregnancyConfirmedAt !== undefined)
      data.pregnancyConfirmedAt = params.pregnancyConfirmedAt;
    if (params.expectedWhelp !== undefined)
      data.expectedWhelp = params.expectedWhelp;
    if (params.litterSizeUltrasound !== undefined)
      data.litterSizeUltrasound = params.litterSizeUltrasound;
    if (params.litterSizeXray !== undefined)
      data.litterSizeXray = params.litterSizeXray;
    if (params.actualWhelp !== undefined) data.actualWhelp = params.actualWhelp;
    if (params.litterSizeBorn !== undefined)
      data.litterSizeBorn = params.litterSizeBorn;
    if (params.litterSizeAlive !== undefined)
      data.litterSizeAlive = params.litterSizeAlive;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.reproductiveRecord.update({
      where: { id },
      data,
      select: repSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "REPRODUCTIVE_RECORD_UPDATED",
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },
};
