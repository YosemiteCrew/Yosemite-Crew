import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class BloodTransfusionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BloodTransfusionError";
  }
}

type BloodType =
  | "DEA_1_POSITIVE"
  | "DEA_1_NEGATIVE"
  | "TYPE_A"
  | "TYPE_B"
  | "TYPE_AB"
  | "UNKNOWN";

type TransfusionReaction =
  | "NONE"
  | "FEBRILE"
  | "HAEMOLYTIC"
  | "ALLERGIC"
  | "ANAPHYLACTIC"
  | "CIRCULATORY_OVERLOAD"
  | "OTHER";

export interface RecordTransfusionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  donorId?: string;
  productType: string;
  bloodType: BloodType;
  volumeMl: number;
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
  reaction?: TransfusionReaction;
  reactionNotes?: string;
  administeredBy?: string;
  crossMatchDone?: boolean;
  crossMatchResult?: string;
  preTransfusionPCV?: number;
  postTransfusionPCV?: number;
}

export interface ReportReactionParams {
  reaction: TransfusionReaction;
  reactionNotes?: string;
}

export interface UpdateTransfusionParams {
  endedAt?: Date;
  durationMinutes?: number;
  reaction?: TransfusionReaction;
  reactionNotes?: string;
  crossMatchResult?: string;
  postTransfusionPCV?: number;
}

export interface ListTransfusionsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
}

const transfusionSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  donorId: true,
  productType: true,
  bloodType: true,
  volumeMl: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  reaction: true,
  reactionNotes: true,
  administeredBy: true,
  crossMatchDone: true,
  crossMatchResult: true,
  preTransfusionPCV: true,
  postTransfusionPCV: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BloodTransfusionSelect;

const assertTransfusion = async (id: string, organisationId: string) => {
  const record = await prisma.bloodTransfusion.findFirst({
    where: { id, organisationId },
    select: transfusionSelect,
  });
  if (!record) {
    throw new BloodTransfusionError("Transfusion record not found.", 404);
  }
  return record;
};

export const BloodTransfusionService = {
  async record(params: RecordTransfusionParams) {
    const { organisationId, patientId, administeredBy, ...rest } = params;

    const record = await prisma.bloodTransfusion.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        donorId: rest.donorId ?? null,
        productType: rest.productType,
        bloodType: rest.bloodType,
        volumeMl: rest.volumeMl,
        startedAt: rest.startedAt,
        endedAt: rest.endedAt ?? null,
        durationMinutes: rest.durationMinutes ?? null,
        reaction: rest.reaction ?? "NONE",
        reactionNotes: rest.reactionNotes ?? null,
        administeredBy: administeredBy ?? null,
        crossMatchDone: rest.crossMatchDone ?? false,
        crossMatchResult: rest.crossMatchResult ?? null,
        preTransfusionPCV: rest.preTransfusionPCV ?? null,
        postTransfusionPCV: rest.postTransfusionPCV ?? null,
      },
      select: transfusionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "TRANSFUSION_RECORDED",
      actorType: "PMS_USER",
      actorId: administeredBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: {
        productType: rest.productType,
        bloodType: rest.bloodType,
        volumeMl: rest.volumeMl,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertTransfusion(id, organisationId);
  },

  async list(params: ListTransfusionsParams) {
    const { organisationId, patientId, encounterId } = params;
    return prisma.bloodTransfusion.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
      },
      select: transfusionSelect,
      orderBy: { startedAt: "desc" },
    });
  },

  async reportReaction(
    id: string,
    organisationId: string,
    params: ReportReactionParams,
    reportedBy?: string,
  ) {
    const record = await assertTransfusion(id, organisationId);
    if (record.reaction !== "NONE") {
      throw new BloodTransfusionError(
        "A reaction has already been reported for this transfusion.",
        409,
      );
    }

    const updated = await prisma.bloodTransfusion.update({
      where: { id },
      data: {
        reaction: params.reaction,
        reactionNotes: params.reactionNotes ?? null,
      },
      select: transfusionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "TRANSFUSION_REACTION_REPORTED",
      actorType: "PMS_USER",
      actorId: reportedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { reaction: params.reaction },
    });

    return updated;
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateTransfusionParams,
  ) {
    await assertTransfusion(id, organisationId);

    const data: Prisma.BloodTransfusionUpdateInput = {};
    if (params.endedAt !== undefined) data.endedAt = params.endedAt;
    if (params.durationMinutes !== undefined)
      data.durationMinutes = params.durationMinutes;
    if (params.reaction !== undefined) data.reaction = params.reaction;
    if (params.reactionNotes !== undefined)
      data.reactionNotes = params.reactionNotes;
    if (params.crossMatchResult !== undefined)
      data.crossMatchResult = params.crossMatchResult;
    if (params.postTransfusionPCV !== undefined)
      data.postTransfusionPCV = params.postTransfusionPCV;

    return prisma.bloodTransfusion.update({
      where: { id },
      data,
      select: transfusionSelect,
    });
  },
};
