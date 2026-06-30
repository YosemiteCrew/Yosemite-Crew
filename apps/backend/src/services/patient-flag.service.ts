import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientFlagError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientFlagError";
  }
}

type PatientFlagType =
  | "AGGRESSION"
  | "ESCAPE_RISK"
  | "ALLERGY_WARNING"
  | "ANXIETY"
  | "SPECIAL_HANDLING"
  | "BILLING_NOTE"
  | "VIP"
  | "QUARANTINE"
  | "OTHER";

type FlagSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CreateFlagParams {
  organisationId: string;
  patientId: string;
  flagType: PatientFlagType;
  severity?: FlagSeverity;
  title: string;
  description?: string;
  createdBy?: string;
}

const flagSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  flagType: true,
  severity: true,
  title: true,
  description: true,
  isActive: true,
  createdBy: true,
  resolvedAt: true,
  resolvedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientFlagSelect;

const assertFlag = async (id: string, organisationId: string) => {
  const flag = await prisma.patientFlag.findFirst({
    where: { id, organisationId },
    select: flagSelect,
  });
  if (!flag) throw new PatientFlagError("Patient flag not found.", 404);
  return flag;
};

export const PatientFlagService = {
  async create(params: CreateFlagParams) {
    const flag = await prisma.patientFlag.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        flagType: params.flagType,
        severity: params.severity ?? "MEDIUM",
        title: params.title,
        description: params.description ?? null,
        createdBy: params.createdBy ?? null,
        isActive: true,
      },
      select: flagSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "PATIENT_FLAG_CREATED",
      actorType: "PMS_USER",
      actorId: params.createdBy ?? null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        flagId: flag.id,
        flagType: params.flagType,
        severity: flag.severity,
      },
    });

    return flag;
  },

  async get(id: string, organisationId: string) {
    return assertFlag(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    flagType?: PatientFlagType;
    severity?: FlagSeverity;
    isActive?: boolean;
  }) {
    const { organisationId, patientId, flagType, severity, isActive } = params;
    return prisma.patientFlag.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(flagType ? { flagType } : {}),
        ...(severity ? { severity } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: flagSelect,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: {
      flagType?: PatientFlagType;
      severity?: FlagSeverity;
      title?: string;
      description?: string;
    },
  ) {
    const existing = await assertFlag(id, organisationId);
    if (!existing.isActive) {
      throw new PatientFlagError("Cannot update a resolved flag.", 409);
    }
    return prisma.patientFlag.update({
      where: { id },
      data: {
        ...(params.flagType ? { flagType: params.flagType } : {}),
        ...(params.severity ? { severity: params.severity } : {}),
        ...(params.title ? { title: params.title } : {}),
        ...(params.description !== undefined
          ? { description: params.description }
          : {}),
      },
      select: flagSelect,
    });
  },

  async resolve(id: string, organisationId: string, resolvedBy?: string) {
    const existing = await assertFlag(id, organisationId);
    if (!existing.isActive) {
      throw new PatientFlagError("Flag is already resolved.", 409);
    }

    const flag = await prisma.patientFlag.update({
      where: { id },
      data: {
        isActive: false,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy ?? null,
      },
      select: flagSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "PATIENT_FLAG_RESOLVED",
      actorType: "PMS_USER",
      actorId: resolvedBy ?? null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: { flagId: id, flagType: existing.flagType },
    });

    return flag;
  },
};
