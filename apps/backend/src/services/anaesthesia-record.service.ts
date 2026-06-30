import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma, AnesthesiaType } from "@prisma/client";

export class AnaesthesiaRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AnaesthesiaRecordError";
  }
}

type AnaesthesiaStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";

const TERMINAL_STATUSES: AnaesthesiaStatus[] = ["COMPLETED", "ABORTED"];

export interface CreateAnaesthesiaParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
  surgicalProcedureId?: string;
  anaesthetistId?: string;
  anesthesiaType?: AnesthesiaType;
  inductionAgent?: string;
  maintenanceAgent?: string;
  oxygenFlowLpm?: number;
  preOpAssessment?: string;
  preMedications?: Record<string, unknown>;
}

const recordSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  appointmentId: true,
  surgicalProcedureId: true,
  anaesthetistId: true,
  anesthesiaType: true,
  inductionAgent: true,
  maintenanceAgent: true,
  oxygenFlowLpm: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  preOpAssessment: true,
  preMedications: true,
  intraOpNotes: true,
  complications: true,
  recoveryNotes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AnaesthesiaRecordSelect;

const assertRecord = async (id: string, organisationId: string) => {
  const record = await prisma.anaesthesiaRecord.findFirst({
    where: { id, organisationId },
    select: recordSelect,
  });
  if (!record)
    throw new AnaesthesiaRecordError("Anaesthesia record not found.", 404);
  return record;
};

export const AnaesthesiaRecordService = {
  async plan(params: CreateAnaesthesiaParams) {
    return prisma.anaesthesiaRecord.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        appointmentId: params.appointmentId ?? null,
        surgicalProcedureId: params.surgicalProcedureId ?? null,
        anaesthetistId: params.anaesthetistId ?? null,
        anesthesiaType: params.anesthesiaType ?? null,
        inductionAgent: params.inductionAgent ?? null,
        maintenanceAgent: params.maintenanceAgent ?? null,
        oxygenFlowLpm: params.oxygenFlowLpm ?? null,
        preOpAssessment: params.preOpAssessment ?? null,
        ...(params.preMedications
          ? { preMedications: params.preMedications as Prisma.InputJsonValue }
          : {}),
        status: "PLANNED",
      },
      select: recordSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertRecord(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    appointmentId?: string;
    status?: AnaesthesiaStatus;
  }) {
    const { organisationId, patientId, appointmentId, status } = params;
    return prisma.anaesthesiaRecord.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(appointmentId ? { appointmentId } : {}),
        ...(status ? { status } : {}),
      },
      select: recordSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async start(id: string, organisationId: string) {
    const existing = await assertRecord(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as AnaesthesiaStatus)) {
      throw new AnaesthesiaRecordError(
        `Cannot start anaesthesia with status ${existing.status}.`,
        409,
      );
    }

    const record = await prisma.anaesthesiaRecord.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      select: recordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ANAESTHESIA_STARTED",
      actorType: "PMS_USER",
      actorId: existing.anaesthetistId,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {
        anaesthesiaId: id,
        inductionAgent: existing.inductionAgent,
      },
    });

    return record;
  },

  async updateIntraOpNotes(
    id: string,
    organisationId: string,
    intraOpNotes: Record<string, unknown>,
  ) {
    const existing = await assertRecord(id, organisationId);
    if (existing.status !== "IN_PROGRESS") {
      throw new AnaesthesiaRecordError(
        "Intra-operative notes can only be updated during an active anaesthesia.",
        409,
      );
    }
    return prisma.anaesthesiaRecord.update({
      where: { id },
      data: { intraOpNotes: intraOpNotes as Prisma.InputJsonValue },
      select: recordSelect,
    });
  },

  async complete(
    id: string,
    organisationId: string,
    params: {
      complications?: string;
      recoveryNotes?: string;
    },
  ) {
    const existing = await assertRecord(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as AnaesthesiaStatus)) {
      throw new AnaesthesiaRecordError(
        `Cannot complete anaesthesia with status ${existing.status}.`,
        409,
      );
    }

    const endedAt = new Date();
    const startedAt = existing.startedAt ?? endedAt;
    const durationMinutes = Math.round(
      (endedAt.getTime() - new Date(startedAt).getTime()) / 60000,
    );

    const record = await prisma.anaesthesiaRecord.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endedAt,
        durationMinutes,
        complications: params.complications ?? null,
        recoveryNotes: params.recoveryNotes ?? null,
      },
      select: recordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ANAESTHESIA_COMPLETED",
      actorType: "PMS_USER",
      actorId: existing.anaesthetistId,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: { anaesthesiaId: id, durationMinutes },
    });

    return record;
  },

  async abort(id: string, organisationId: string, complications?: string) {
    const existing = await assertRecord(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as AnaesthesiaStatus)) {
      throw new AnaesthesiaRecordError(
        `Cannot abort anaesthesia with status ${existing.status}.`,
        409,
      );
    }

    const record = await prisma.anaesthesiaRecord.update({
      where: { id },
      data: {
        status: "ABORTED",
        endedAt: new Date(),
        complications: complications ?? null,
      },
      select: recordSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ANAESTHESIA_ABORTED",
      actorType: "PMS_USER",
      actorId: existing.anaesthetistId,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: { anaesthesiaId: id, complications },
    });

    return record;
  },
};
