import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class HospitalizationMonitoringError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "HospitalizationMonitoringError";
  }
}

export interface RecordObsParams {
  organisationId: string;
  patientId: string;
  admissionId?: string;
  encounterId?: string;
  observedAt: Date;
  observedBy?: string;
  temperature?: number;
  temperatureUnit?: string;
  heartRate?: number;
  respiratoryRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  etco2?: number;
  painScore?: number;
  crtSecs?: number;
  mucousMembranes?: string;
  inputMl?: number;
  outputMl?: number;
  mentalStatus?: string;
  appetite?: string;
  urination?: string;
  defecation?: string;
  notes?: string;
}

export interface ListObsParams {
  organisationId: string;
  patientId?: string;
  admissionId?: string;
  encounterId?: string;
  from?: Date;
  to?: Date;
}

const obsSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  admissionId: true,
  encounterId: true,
  observedAt: true,
  observedBy: true,
  temperature: true,
  temperatureUnit: true,
  heartRate: true,
  respiratoryRate: true,
  spo2: true,
  bloodPressureSystolic: true,
  bloodPressureDiastolic: true,
  etco2: true,
  painScore: true,
  crtSecs: true,
  mucousMembranes: true,
  inputMl: true,
  outputMl: true,
  mentalStatus: true,
  appetite: true,
  urination: true,
  defecation: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HospitalizationMonitoringSelect;

const assertObs = async (id: string, organisationId: string) => {
  const record = await prisma.hospitalizationMonitoring.findFirst({
    where: { id, organisationId },
    select: obsSelect,
  });
  if (!record) {
    throw new HospitalizationMonitoringError(
      "Monitoring observation not found.",
      404,
    );
  }
  return record;
};

export const HospitalizationMonitoringService = {
  async record(params: RecordObsParams) {
    const { organisationId, patientId, observedBy, ...rest } = params;

    const obs = await prisma.hospitalizationMonitoring.create({
      data: {
        organisationId,
        patientId,
        admissionId: rest.admissionId ?? null,
        encounterId: rest.encounterId ?? null,
        observedAt: rest.observedAt,
        observedBy: observedBy ?? null,
        temperature: rest.temperature ?? null,
        temperatureUnit: rest.temperatureUnit ?? null,
        heartRate: rest.heartRate ?? null,
        respiratoryRate: rest.respiratoryRate ?? null,
        spo2: rest.spo2 ?? null,
        bloodPressureSystolic: rest.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: rest.bloodPressureDiastolic ?? null,
        etco2: rest.etco2 ?? null,
        painScore: rest.painScore ?? null,
        crtSecs: rest.crtSecs ?? null,
        mucousMembranes: rest.mucousMembranes ?? null,
        inputMl: rest.inputMl ?? null,
        outputMl: rest.outputMl ?? null,
        mentalStatus: rest.mentalStatus ?? null,
        appetite: rest.appetite ?? null,
        urination: rest.urination ?? null,
        defecation: rest.defecation ?? null,
        notes: rest.notes ?? null,
      },
      select: obsSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "HOSPITALIZATION_OBS_RECORDED",
      actorType: "PMS_USER",
      actorId: observedBy ?? null,
      entityType: "COMPANION",
      entityId: obs.id,
      metadata: {
        observedAt: rest.observedAt.toISOString(),
        painScore: rest.painScore ?? null,
        heartRate: rest.heartRate ?? null,
      },
    });

    return obs;
  },

  async get(id: string, organisationId: string) {
    return assertObs(id, organisationId);
  },

  async list(params: ListObsParams) {
    const { organisationId, patientId, admissionId, encounterId, from, to } =
      params;
    return prisma.hospitalizationMonitoring.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(admissionId ? { admissionId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(from || to
          ? {
              observedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: obsSelect,
      orderBy: { observedAt: "asc" },
    });
  },

  async delete(id: string, organisationId: string) {
    await assertObs(id, organisationId);
    await prisma.hospitalizationMonitoring.delete({ where: { id } });
  },
};
