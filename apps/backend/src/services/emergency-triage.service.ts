import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class EmergencyTriageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "EmergencyTriageError";
  }
}

type TriagePriority =
  | "IMMEDIATE"
  | "URGENT"
  | "LESS_URGENT"
  | "STANDARD"
  | "NON_URGENT";

export interface RecordTriageParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  triagePriority: TriagePriority;
  chiefComplaint: string;
  presentationAt: Date;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  capillaryRefillTime?: number;
  mentalStatus?: string;
  triageBy?: string;
  notes?: string;
}

export interface EscalateTriageParams {
  escalatedReason: string;
}

export interface ListTriageParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  from?: Date;
  to?: Date;
}

const triageSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  triagePriority: true,
  chiefComplaint: true,
  presentationAt: true,
  heartRate: true,
  respiratoryRate: true,
  temperature: true,
  bloodPressureSystolic: true,
  bloodPressureDiastolic: true,
  oxygenSaturation: true,
  capillaryRefillTime: true,
  mentalStatus: true,
  escalated: true,
  escalatedAt: true,
  escalatedReason: true,
  triageBy: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmergencyTriageSelect;

const assertTriage = async (id: string, organisationId: string) => {
  const record = await prisma.emergencyTriage.findFirst({
    where: { id, organisationId },
    select: triageSelect,
  });
  if (!record) {
    throw new EmergencyTriageError("Emergency triage record not found.", 404);
  }
  return record;
};

export const EmergencyTriageService = {
  async record(params: RecordTriageParams) {
    const { organisationId, patientId, triageBy, ...rest } = params;

    const triage = await prisma.emergencyTriage.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        triagePriority: rest.triagePriority,
        chiefComplaint: rest.chiefComplaint,
        presentationAt: rest.presentationAt,
        heartRate: rest.heartRate ?? null,
        respiratoryRate: rest.respiratoryRate ?? null,
        temperature: rest.temperature ?? null,
        bloodPressureSystolic: rest.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: rest.bloodPressureDiastolic ?? null,
        oxygenSaturation: rest.oxygenSaturation ?? null,
        capillaryRefillTime: rest.capillaryRefillTime ?? null,
        mentalStatus: rest.mentalStatus ?? null,
        triageBy: triageBy ?? null,
        notes: rest.notes ?? null,
      },
      select: triageSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "EMERGENCY_TRIAGE_RECORDED",
      actorType: "PMS_USER",
      actorId: triageBy ?? null,
      entityType: "COMPANION",
      entityId: triage.id,
      metadata: {
        triagePriority: rest.triagePriority,
        chiefComplaint: rest.chiefComplaint,
      },
    });

    return triage;
  },

  async get(id: string, organisationId: string) {
    return assertTriage(id, organisationId);
  },

  async list(params: ListTriageParams) {
    const { organisationId, patientId, encounterId, from, to } = params;
    return prisma.emergencyTriage.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(from || to
          ? {
              presentationAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: triageSelect,
      orderBy: { presentationAt: "desc" },
    });
  },

  async escalate(
    id: string,
    organisationId: string,
    params: EscalateTriageParams,
    escalatedBy?: string,
  ) {
    const existing = await assertTriage(id, organisationId);
    if (existing.escalated) {
      throw new EmergencyTriageError(
        "Triage record is already escalated.",
        409,
      );
    }

    const updated = await prisma.emergencyTriage.update({
      where: { id },
      data: {
        escalated: true,
        escalatedAt: new Date(),
        escalatedReason: params.escalatedReason,
      },
      select: triageSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "EMERGENCY_TRIAGE_ESCALATED",
      actorType: "PMS_USER",
      actorId: escalatedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        triagePriority: existing.triagePriority,
        escalatedReason: params.escalatedReason,
      },
    });

    return updated;
  },
};
