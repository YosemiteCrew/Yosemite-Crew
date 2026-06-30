import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class DischargeInstructionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DischargeInstructionError";
  }
}

type DischargeStatus = "DRAFT" | "SENT" | "ACKNOWLEDGED";

export interface CreateDischargeInstructionParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  medicationSchedule?: string;
  dietaryNotes?: string;
  activityNotes?: string;
  woundCareNotes?: string;
  warningSigns?: string;
  followUpDate?: Date;
  followUpNotes?: string;
  emergencyContact?: string;
  additionalNotes?: string;
  preparedBy?: string;
}

export interface UpdateDischargeInstructionParams {
  medicationSchedule?: string;
  dietaryNotes?: string;
  activityNotes?: string;
  woundCareNotes?: string;
  warningSigns?: string;
  followUpDate?: Date;
  followUpNotes?: string;
  emergencyContact?: string;
  additionalNotes?: string;
}

export interface ListDischargeInstructionsParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: DischargeStatus;
}

const dischargeSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  status: true,
  medicationSchedule: true,
  dietaryNotes: true,
  activityNotes: true,
  woundCareNotes: true,
  warningSigns: true,
  followUpDate: true,
  followUpNotes: true,
  emergencyContact: true,
  additionalNotes: true,
  preparedBy: true,
  sentAt: true,
  acknowledgedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DischargeInstructionSelect;

const assertDischarge = async (id: string, organisationId: string) => {
  const record = await prisma.dischargeInstruction.findFirst({
    where: { id, organisationId },
    select: dischargeSelect,
  });
  if (!record) {
    throw new DischargeInstructionError(
      "Discharge instruction not found.",
      404,
    );
  }
  return record;
};

export const DischargeInstructionService = {
  async create(params: CreateDischargeInstructionParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      preparedBy,
      followUpDate,
      ...rest
    } = params;

    const record = await prisma.dischargeInstruction.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        status: "DRAFT",
        preparedBy: preparedBy ?? null,
        followUpDate: followUpDate ?? null,
        medicationSchedule: rest.medicationSchedule ?? null,
        dietaryNotes: rest.dietaryNotes ?? null,
        activityNotes: rest.activityNotes ?? null,
        woundCareNotes: rest.woundCareNotes ?? null,
        warningSigns: rest.warningSigns ?? null,
        followUpNotes: rest.followUpNotes ?? null,
        emergencyContact: rest.emergencyContact ?? null,
        additionalNotes: rest.additionalNotes ?? null,
      },
      select: dischargeSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "DISCHARGE_INSTRUCTIONS_CREATED",
      actorType: "PMS_USER",
      actorId: preparedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { encounterId: encounterId ?? null },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertDischarge(id, organisationId);
  },

  async list(params: ListDischargeInstructionsParams) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.dischargeInstruction.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
      },
      select: dischargeSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateDischargeInstructionParams,
    updatedBy?: string,
  ) {
    const record = await assertDischarge(id, organisationId);
    if (record.status !== "DRAFT") {
      throw new DischargeInstructionError(
        "Only DRAFT discharge instructions can be edited.",
        409,
      );
    }

    const data: Prisma.DischargeInstructionUpdateInput = {};
    if (params.medicationSchedule !== undefined)
      data.medicationSchedule = params.medicationSchedule;
    if (params.dietaryNotes !== undefined)
      data.dietaryNotes = params.dietaryNotes;
    if (params.activityNotes !== undefined)
      data.activityNotes = params.activityNotes;
    if (params.woundCareNotes !== undefined)
      data.woundCareNotes = params.woundCareNotes;
    if (params.warningSigns !== undefined)
      data.warningSigns = params.warningSigns;
    if (params.followUpDate !== undefined)
      data.followUpDate = params.followUpDate;
    if (params.followUpNotes !== undefined)
      data.followUpNotes = params.followUpNotes;
    if (params.emergencyContact !== undefined)
      data.emergencyContact = params.emergencyContact;
    if (params.additionalNotes !== undefined)
      data.additionalNotes = params.additionalNotes;

    return prisma.dischargeInstruction.update({
      where: { id },
      data,
      select: dischargeSelect,
    });
  },

  async send(id: string, organisationId: string, sentBy?: string) {
    const record = await assertDischarge(id, organisationId);
    if (record.status !== "DRAFT") {
      throw new DischargeInstructionError(
        "Only DRAFT discharge instructions can be sent.",
        409,
      );
    }

    const updated = await prisma.dischargeInstruction.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      select: dischargeSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "DISCHARGE_INSTRUCTIONS_SENT",
      actorType: "PMS_USER",
      actorId: sentBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async acknowledge(id: string, organisationId: string) {
    const record = await assertDischarge(id, organisationId);
    if (record.status === "ACKNOWLEDGED") {
      throw new DischargeInstructionError(
        "Discharge instructions already acknowledged.",
        409,
      );
    }

    const updated = await prisma.dischargeInstruction.update({
      where: { id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      select: dischargeSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "DISCHARGE_INSTRUCTIONS_ACKNOWLEDGED",
      actorType: "PARENT",
      actorId: null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },
};
