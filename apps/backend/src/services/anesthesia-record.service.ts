import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class AnesthesiaRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AnesthesiaRecordError";
  }
}

type AnesthesiaType =
  | "GENERAL"
  | "LOCAL"
  | "SEDATION"
  | "EPIDURAL"
  | "REGIONAL"
  | "TOTAL_IV"
  | "NONE";

type AnesthesiaStatus = "IN_PROGRESS" | "COMPLETED" | "ABORTED";

export interface CreateAnesthesiaRecordParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  anesthesiaType?: AnesthesiaType;
  anesthesiologist?: string;
  assistantName?: string;
  preMedication?: string;
  inductionAgent?: string;
  maintenanceAgent?: string;
  oxygenFlowLpm?: number;
  inductionTime?: Date;
  intubationTime?: Date;
  notes?: string;
}

export interface UpdateAnesthesiaRecordParams {
  anesthesiaType?: AnesthesiaType;
  anesthesiologist?: string;
  assistantName?: string;
  preMedication?: string;
  inductionAgent?: string;
  maintenanceAgent?: string;
  oxygenFlowLpm?: number;
  inductionTime?: Date;
  intubationTime?: Date;
  recoveryStartTime?: Date;
  recoveryEndTime?: Date;
  complications?: string;
  recoveryNotes?: string;
  status?: AnesthesiaStatus;
  notes?: string;
}

export interface ListAnesthesiaRecordsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  surgicalProcedureId?: string;
  status?: AnesthesiaStatus;
}

const recordSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  surgicalProcedureId: true,
  anesthesiaType: true,
  anesthesiologist: true,
  assistantName: true,
  preMedication: true,
  inductionAgent: true,
  maintenanceAgent: true,
  oxygenFlowLpm: true,
  inductionTime: true,
  intubationTime: true,
  recoveryStartTime: true,
  recoveryEndTime: true,
  complications: true,
  recoveryNotes: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AnesthesiaRecordSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.anesthesiaRecord.findFirst({
    where: { id, organisationId },
    select: recordSelect,
  });
  if (!record) {
    throw new AnesthesiaRecordError("Anesthesia record not found.", 404);
  }
  return record;
};

export const AnesthesiaRecordService = {
  async create(params: CreateAnesthesiaRecordParams) {
    const { organisationId, patientId, anesthesiologist, ...rest } = params;

    const record = await prisma.anesthesiaRecord.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
        anesthesiaType: rest.anesthesiaType ?? "GENERAL",
        anesthesiologist: anesthesiologist ?? null,
        assistantName: rest.assistantName ?? null,
        preMedication: rest.preMedication ?? null,
        inductionAgent: rest.inductionAgent ?? null,
        maintenanceAgent: rest.maintenanceAgent ?? null,
        oxygenFlowLpm: rest.oxygenFlowLpm ?? null,
        inductionTime: rest.inductionTime ?? null,
        intubationTime: rest.intubationTime ?? null,
        status: "IN_PROGRESS",
        notes: rest.notes ?? null,
      },
      select: recordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ANESTHESIA_RECORD_CREATED",
      actorType: "PMS_USER",
      actorId: anesthesiologist ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        anesthesiaType: record.anesthesiaType,
        surgicalProcedureId: rest.surgicalProcedureId ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: ListAnesthesiaRecordsParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      surgicalProcedureId,
      status,
    } = params;
    return prisma.anesthesiaRecord.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(surgicalProcedureId ? { surgicalProcedureId } : {}),
        ...(status ? { status } : {}),
      },
      select: recordSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateAnesthesiaRecordParams,
    updatedBy?: string,
  ) {
    const existing = await assertRecord(id, organisationId);
    if (existing.status === "COMPLETED" || existing.status === "ABORTED") {
      throw new AnesthesiaRecordError(
        "Cannot update a completed or aborted anesthesia record.",
        409,
      );
    }

    const data: Prisma.AnesthesiaRecordUpdateInput = {};
    if (params.anesthesiaType !== undefined)
      data.anesthesiaType = params.anesthesiaType;
    if (params.anesthesiologist !== undefined)
      data.anesthesiologist = params.anesthesiologist;
    if (params.assistantName !== undefined)
      data.assistantName = params.assistantName;
    if (params.preMedication !== undefined)
      data.preMedication = params.preMedication;
    if (params.inductionAgent !== undefined)
      data.inductionAgent = params.inductionAgent;
    if (params.maintenanceAgent !== undefined)
      data.maintenanceAgent = params.maintenanceAgent;
    if (params.oxygenFlowLpm !== undefined)
      data.oxygenFlowLpm = params.oxygenFlowLpm;
    if (params.inductionTime !== undefined)
      data.inductionTime = params.inductionTime;
    if (params.intubationTime !== undefined)
      data.intubationTime = params.intubationTime;
    if (params.recoveryStartTime !== undefined)
      data.recoveryStartTime = params.recoveryStartTime;
    if (params.recoveryEndTime !== undefined)
      data.recoveryEndTime = params.recoveryEndTime;
    if (params.complications !== undefined)
      data.complications = params.complications;
    if (params.recoveryNotes !== undefined)
      data.recoveryNotes = params.recoveryNotes;
    if (params.status !== undefined) data.status = params.status;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await prisma.anesthesiaRecord.update({
      where: { id },
      data,
      select: recordSelect,
    });

    const eventType =
      params.status === "COMPLETED" || params.status === "ABORTED"
        ? "ANESTHESIA_RECORD_COMPLETED"
        : "ANESTHESIA_RECORD_UPDATED";

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { status: updated.status },
    });

    return updated;
  },
};
