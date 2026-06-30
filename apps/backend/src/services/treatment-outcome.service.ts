import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class TreatmentOutcomeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TreatmentOutcomeError";
  }
}

type TreatmentOutcomeType =
  | "RECOVERED"
  | "IMPROVED"
  | "STABLE"
  | "DETERIORATED"
  | "DECEASED"
  | "REFERRED_OUT"
  | "LOST_TO_FOLLOWUP"
  | "ONGOING";

export interface CreateOutcomeParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  episodeOfCareId?: string;
  recordedAt: Date;
  recordedBy?: string;
  outcomeType: TreatmentOutcomeType;
  clinicalNotes?: string;
  followUpDate?: Date;
  followUpNotes?: string;
}

const outcomeSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  episodeOfCareId: true,
  recordedAt: true,
  recordedBy: true,
  outcomeType: true,
  clinicalNotes: true,
  followUpDate: true,
  followUpNotes: true,
  resolved: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TreatmentOutcomeSelect;

const assertOutcome = async (id: string, organisationId: string) => {
  const record = await prisma.treatmentOutcome.findFirst({
    where: { id, organisationId },
    select: outcomeSelect,
  });
  if (!record)
    throw new TreatmentOutcomeError("Treatment outcome not found.", 404);
  return record;
};

export const TreatmentOutcomeService = {
  async record(params: CreateOutcomeParams) {
    const outcome = await prisma.treatmentOutcome.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        episodeOfCareId: params.episodeOfCareId ?? null,
        recordedAt: params.recordedAt,
        recordedBy: params.recordedBy ?? null,
        outcomeType: params.outcomeType,
        clinicalNotes: params.clinicalNotes ?? null,
        followUpDate: params.followUpDate ?? null,
        followUpNotes: params.followUpNotes ?? null,
        resolved: params.outcomeType === "RECOVERED",
      },
      select: outcomeSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "TREATMENT_OUTCOME_RECORDED",
      actorType: "PMS_USER",
      actorId: params.recordedBy ?? null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        outcomeId: outcome.id,
        outcomeType: params.outcomeType,
        encounterId: params.encounterId ?? null,
      },
    });

    return outcome;
  },

  async get(id: string, organisationId: string) {
    return assertOutcome(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    outcomeType?: TreatmentOutcomeType;
    resolved?: boolean;
    encounterId?: string;
  }) {
    const { organisationId, patientId, outcomeType, resolved, encounterId } =
      params;
    return prisma.treatmentOutcome.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(outcomeType ? { outcomeType } : {}),
        ...(resolved !== undefined ? { resolved } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: outcomeSelect,
      orderBy: { recordedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: {
      outcomeType?: TreatmentOutcomeType;
      clinicalNotes?: string;
      followUpDate?: Date | null;
      followUpNotes?: string;
      resolved?: boolean;
    },
  ) {
    await assertOutcome(id, organisationId);

    const resolvedFlag =
      params.resolved !== undefined
        ? params.resolved
        : params.outcomeType === "RECOVERED"
          ? true
          : undefined;

    return prisma.treatmentOutcome.update({
      where: { id },
      data: {
        ...(params.outcomeType ? { outcomeType: params.outcomeType } : {}),
        ...(params.clinicalNotes !== undefined
          ? { clinicalNotes: params.clinicalNotes }
          : {}),
        ...(params.followUpDate !== undefined
          ? { followUpDate: params.followUpDate }
          : {}),
        ...(params.followUpNotes !== undefined
          ? { followUpNotes: params.followUpNotes }
          : {}),
        ...(resolvedFlag !== undefined ? { resolved: resolvedFlag } : {}),
      },
      select: outcomeSelect,
    });
  },

  async resolve(id: string, organisationId: string) {
    await assertOutcome(id, organisationId);
    return prisma.treatmentOutcome.update({
      where: { id },
      data: { resolved: true },
      select: outcomeSelect,
    });
  },
};
