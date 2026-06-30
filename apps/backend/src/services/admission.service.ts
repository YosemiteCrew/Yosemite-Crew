import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class AdmissionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AdmissionError";
  }
}

export interface CreateAdmissionParams {
  encounterId: string;
  organisationId: string;
  patientId: string;
  unitId?: string;
  expectedStayDays?: number;
  admittedAt: Date;
  admittedBy?: string;
}

export interface UpdateAdmissionParams {
  unitId?: string;
  expectedStayDays?: number;
  admittedBy?: string;
}

export interface DischargeParams {
  dischargedAt: Date;
  dischargedBy?: string;
}

export interface ListAdmissionParams {
  organisationId: string;
  active?: boolean;
  patientId?: string;
}

const admissionSelect = {
  encounterId: true,
  organisationId: true,
  patientId: true,
  unitId: true,
  expectedStayDays: true,
  admittedAt: true,
  admittedBy: true,
  dischargedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdmissionSelect;

const assertAdmission = async (encounterId: string, organisationId: string) => {
  const admission = await prisma.admission.findFirst({
    where: { encounterId, organisationId },
    select: admissionSelect,
  });
  if (!admission) {
    throw new AdmissionError("Admission not found.", 404);
  }
  return admission;
};

export const AdmissionService = {
  async admit(params: CreateAdmissionParams) {
    const { organisationId, patientId, admittedBy, ...rest } = params;

    const existing = await prisma.admission.findFirst({
      where: { encounterId: rest.encounterId, organisationId },
      select: { encounterId: true, dischargedAt: true },
    });
    if (existing && !existing.dischargedAt) {
      throw new AdmissionError(
        "An active admission already exists for this encounter.",
        409,
      );
    }

    const admission = await prisma.admission.create({
      data: {
        encounterId: rest.encounterId,
        organisationId,
        patientId,
        unitId: rest.unitId ?? null,
        expectedStayDays: rest.expectedStayDays ?? null,
        admittedAt: rest.admittedAt,
        admittedBy: admittedBy ?? null,
      },
      select: admissionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ADMISSION_CREATED",
      actorType: "PMS_USER",
      actorId: admittedBy ?? null,
      entityType: "COMPANION",
      entityId: rest.encounterId,
      metadata: {
        admittedAt: rest.admittedAt.toISOString(),
        unitId: rest.unitId ?? null,
      },
    });

    return admission;
  },

  async get(encounterId: string, organisationId: string) {
    return assertAdmission(encounterId, organisationId);
  },

  async list(params: ListAdmissionParams) {
    const { organisationId, active, patientId } = params;
    return prisma.admission.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(active === true ? { dischargedAt: null } : {}),
        ...(active === false ? { dischargedAt: { not: null } } : {}),
      },
      select: admissionSelect,
      orderBy: { admittedAt: "desc" },
    });
  },

  async update(
    encounterId: string,
    organisationId: string,
    params: UpdateAdmissionParams,
  ) {
    await assertAdmission(encounterId, organisationId);

    const data: Prisma.AdmissionUncheckedUpdateInput = {};
    if (params.unitId !== undefined) data.unitId = params.unitId;
    if (params.expectedStayDays !== undefined)
      data.expectedStayDays = params.expectedStayDays;
    if (params.admittedBy !== undefined) data.admittedBy = params.admittedBy;

    return prisma.admission.update({
      where: { encounterId },
      data,
      select: admissionSelect,
    });
  },

  async discharge(
    encounterId: string,
    organisationId: string,
    params: DischargeParams,
  ) {
    const existing = await assertAdmission(encounterId, organisationId);
    if (existing.dischargedAt) {
      throw new AdmissionError("Patient has already been discharged.", 409);
    }

    const admission = await prisma.admission.update({
      where: { encounterId },
      data: { dischargedAt: params.dischargedAt },
      select: admissionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ADMISSION_DISCHARGED",
      actorType: "PMS_USER",
      actorId: params.dischargedBy ?? null,
      entityType: "COMPANION",
      entityId: encounterId,
      metadata: { dischargedAt: params.dischargedAt.toISOString() },
    });

    return admission;
  },
};
