import { prisma } from "src/config/prisma";
import { pickDefined } from "src/utils/pick-defined";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class SurgicalProcedureError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SurgicalProcedureError";
  }
}

type SurgeryOutcome = "SUCCESS" | "COMPLICATION" | "ABANDONED" | "PENDING";
type AnesthesiaType = "GENERAL" | "LOCAL" | "SEDATION" | "EPIDURAL" | "NONE";

export interface CreateSurgicalProcedureParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  procedureName: string;
  surgeon?: string;
  assistants?: string[];
  anesthesiaType?: AnesthesiaType;
  anesthesiaAgent?: string;
  anesthesiaDoseMs?: number;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
  outcome?: SurgeryOutcome;
  complications?: string;
  instruments?: string[];
  specimensSent?: string[];
  postOpNotes?: string;
  performedBy?: string;
}

export interface UpdateSurgicalProcedureParams {
  procedureName?: string;
  surgeon?: string;
  assistants?: string[];
  anesthesiaType?: AnesthesiaType;
  anesthesiaAgent?: string;
  anesthesiaDoseMs?: number;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
  outcome?: SurgeryOutcome;
  complications?: string;
  instruments?: string[];
  specimensSent?: string[];
  postOpNotes?: string;
}

export interface ListSurgicalProceduresParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  outcome?: SurgeryOutcome;
}

const surgerySelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  procedureName: true,
  surgeon: true,
  assistants: true,
  anesthesiaType: true,
  anesthesiaAgent: true,
  anesthesiaDoseMs: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  outcome: true,
  complications: true,
  instruments: true,
  specimensSent: true,
  postOpNotes: true,
  performedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SurgicalProcedureSelect;

const assertSurgery = async (id: string, organisationId: string) => {
  const record = await prisma.surgicalProcedure.findFirst({
    where: { id, organisationId },
    select: surgerySelect,
  });
  if (!record) {
    throw new SurgicalProcedureError(
      "Surgical procedure record not found.",
      404,
    );
  }
  return record;
};

export const SurgicalProcedureService = {
  async create(params: CreateSurgicalProcedureParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      procedureName,
      performedBy,
      ...rest
    } = params;

    const record = await prisma.surgicalProcedure.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        procedureName,
        performedBy: performedBy ?? null,
        outcome: rest.outcome ?? "PENDING",
        anesthesiaType: rest.anesthesiaType ?? "NONE",
        surgeon: rest.surgeon ?? null,
        assistants: rest.assistants ?? [],
        anesthesiaAgent: rest.anesthesiaAgent ?? null,
        anesthesiaDoseMs: rest.anesthesiaDoseMs ?? null,
        startedAt: rest.startedAt ?? null,
        endedAt: rest.endedAt ?? null,
        durationMinutes: rest.durationMinutes ?? null,
        complications: rest.complications ?? null,
        instruments: rest.instruments ?? [],
        specimensSent: rest.specimensSent ?? [],
        postOpNotes: rest.postOpNotes ?? null,
      },
      select: surgerySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "SURGERY_RECORDED",
      actorType: "PMS_USER",
      actorId: performedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { procedureName, outcome: record.outcome },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertSurgery(id, organisationId);
  },

  async list(params: ListSurgicalProceduresParams) {
    const { organisationId, patientId, encounterId, outcome } = params;
    return prisma.surgicalProcedure.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(outcome ? { outcome } : {}),
      },
      select: surgerySelect,
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateSurgicalProcedureParams,
    updatedBy?: string,
  ) {
    const record = await assertSurgery(id, organisationId);

    const data: Prisma.SurgicalProcedureUpdateInput = pickDefined(params, [
      "procedureName",
      "surgeon",
      "assistants",
      "anesthesiaType",
      "anesthesiaAgent",
      "anesthesiaDoseMs",
      "startedAt",
      "endedAt",
      "durationMinutes",
      "outcome",
      "complications",
      "instruments",
      "specimensSent",
      "postOpNotes",
    ]);

    const updated = await prisma.surgicalProcedure.update({
      where: { id },
      data,
      select: surgerySelect,
    });

    const eventType =
      params.outcome !== undefined && params.outcome !== record.outcome
        ? "SURGERY_OUTCOME_UPDATED"
        : "SURGERY_RECORDED";

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType,
      actorType: "PMS_USER",
      actorId: updatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        changedFields: Object.keys(params),
        outcome: updated.outcome,
      },
    });

    return updated;
  },
};
