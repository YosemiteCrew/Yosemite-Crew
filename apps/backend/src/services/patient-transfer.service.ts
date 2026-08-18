import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientTransferError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientTransferError";
  }
}

type TransferType =
  | "REFERRAL_SPECIALIST"
  | "REFERRAL_EMERGENCY"
  | "INTER_HOSPITAL"
  | "CLIENT_TRANSFER"
  | "DISCHARGE_HOME";

export interface CreateTransferParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  transferType: TransferType;
  receivingFacility: string;
  receivingVetName?: string;
  receivingVetContact?: string;
  transferredAt: Date;
  transferredBy?: string;
  chiefComplaint?: string;
  currentDiagnoses?: string;
  ongoingTreatments?: string;
  medicationsDispensed?: string;
  caseSummary?: string;
  criticalAlerts?: string;
  ownerInformed?: boolean;
}

export type UpdateTransferParams = Partial<
  Omit<CreateTransferParams, "organisationId" | "patientId">
>;

const transferSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  transferType: true,
  receivingFacility: true,
  receivingVetName: true,
  receivingVetContact: true,
  transferredAt: true,
  transferredBy: true,
  chiefComplaint: true,
  currentDiagnoses: true,
  ongoingTreatments: true,
  medicationsDispensed: true,
  caseSummary: true,
  criticalAlerts: true,
  ownerInformed: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientTransferSelect;

const assertTransfer = async (id: string, organisationId: string) => {
  const transfer = await prisma.patientTransfer.findFirst({
    where: { id, organisationId },
    select: transferSelect,
  });
  if (!transfer) {
    throw new PatientTransferError("Patient transfer record not found.", 404);
  }
  return transfer;
};

export const PatientTransferService = {
  async create(params: CreateTransferParams) {
    const { organisationId, patientId, transferredBy, ...rest } = params;

    const transfer = await prisma.patientTransfer.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        transferType: rest.transferType,
        receivingFacility: rest.receivingFacility,
        receivingVetName: rest.receivingVetName ?? null,
        receivingVetContact: rest.receivingVetContact ?? null,
        transferredAt: rest.transferredAt,
        transferredBy: transferredBy ?? null,
        chiefComplaint: rest.chiefComplaint ?? null,
        currentDiagnoses: rest.currentDiagnoses ?? null,
        ongoingTreatments: rest.ongoingTreatments ?? null,
        medicationsDispensed: rest.medicationsDispensed ?? null,
        caseSummary: rest.caseSummary ?? null,
        criticalAlerts: rest.criticalAlerts ?? null,
        ownerInformed: rest.ownerInformed ?? false,
      },
      select: transferSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PATIENT_TRANSFER_RECORDED",
      actorType: "PMS_USER",
      actorId: transferredBy ?? null,
      entityType: "COMPANION",
      entityId: transfer.id,
      metadata: {
        transferType: rest.transferType,
        receivingFacility: rest.receivingFacility,
      },
    });

    return transfer;
  },

  async get(id: string, organisationId: string) {
    return assertTransfer(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    transferType?: TransferType;
  }) {
    const { organisationId, patientId, transferType } = params;
    return prisma.patientTransfer.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(transferType ? { transferType } : {}),
      },
      select: transferSelect,
      orderBy: { transferredAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateTransferParams,
  ) {
    await assertTransfer(id, organisationId);

    const data: Prisma.PatientTransferUpdateInput = {};
    if (params.receivingFacility !== undefined)
      data.receivingFacility = params.receivingFacility;
    if (params.receivingVetName !== undefined)
      data.receivingVetName = params.receivingVetName;
    if (params.receivingVetContact !== undefined)
      data.receivingVetContact = params.receivingVetContact;
    if (params.chiefComplaint !== undefined)
      data.chiefComplaint = params.chiefComplaint;
    if (params.currentDiagnoses !== undefined)
      data.currentDiagnoses = params.currentDiagnoses;
    if (params.ongoingTreatments !== undefined)
      data.ongoingTreatments = params.ongoingTreatments;
    if (params.medicationsDispensed !== undefined)
      data.medicationsDispensed = params.medicationsDispensed;
    if (params.caseSummary !== undefined) data.caseSummary = params.caseSummary;
    if (params.criticalAlerts !== undefined)
      data.criticalAlerts = params.criticalAlerts;
    if (params.ownerInformed !== undefined)
      data.ownerInformed = params.ownerInformed;

    return prisma.patientTransfer.update({
      where: { id },
      data,
      select: transferSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertTransfer(id, organisationId);
    await prisma.patientTransfer.delete({ where: { id } });
  },
};
