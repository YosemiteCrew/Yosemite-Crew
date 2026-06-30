import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class MedicationReconciliationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MedicationReconciliationError";
  }
}

type ReconciliationStatus = "IN_PROGRESS" | "COMPLETED" | "PENDING_REVIEW";

export interface HomeMedication {
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
}

export interface HospitalOrder {
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  orderedBy?: string;
}

export interface Discrepancy {
  type:
    | "OMITTED"
    | "ADDED"
    | "CHANGED_DOSE"
    | "CHANGED_FREQUENCY"
    | "CHANGED_ROUTE"
    | "DUPLICATE"
    | "CONTRAINDICATED";
  medication: string;
  comment?: string;
}

export interface CreateMedRecParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  homeMedications: HomeMedication[];
  hospitalOrders: HospitalOrder[];
  discrepancies?: Discrepancy[];
  reconciledBy?: string;
  notes?: string;
}

export interface UpdateMedRecParams {
  homeMedications?: HomeMedication[];
  hospitalOrders?: HospitalOrder[];
  discrepancies?: Discrepancy[];
  notes?: string;
}

export interface CompleteMedRecParams {
  discrepancies?: Discrepancy[];
}

export interface ReviewMedRecParams {
  reviewNotes?: string;
}

export interface ListMedRecParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: ReconciliationStatus;
}

const medRecSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  status: true,
  reconciledBy: true,
  reconciledAt: true,
  homeMedications: true,
  hospitalOrders: true,
  discrepancies: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicationReconciliationSelect;

const assertMedRec = async (id: string, organisationId: string) => {
  const record = await prisma.medicationReconciliation.findFirst({
    where: { id, organisationId },
    select: medRecSelect,
  });
  if (!record) {
    throw new MedicationReconciliationError(
      "Medication reconciliation not found.",
      404,
    );
  }
  return record;
};

export const MedicationReconciliationService = {
  async create(params: CreateMedRecParams) {
    const { organisationId, patientId, reconciledBy, ...rest } = params;

    const medRec = await prisma.medicationReconciliation.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        homeMedications:
          rest.homeMedications as unknown as Prisma.InputJsonValue,
        hospitalOrders: rest.hospitalOrders as unknown as Prisma.InputJsonValue,
        discrepancies: rest.discrepancies
          ? (rest.discrepancies as unknown as Prisma.InputJsonValue)
          : undefined,
        reconciledBy: reconciledBy ?? null,
        status: "IN_PROGRESS",
        notes: rest.notes ?? null,
      },
      select: medRecSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "MEDICATION_RECONCILIATION_STARTED",
      actorType: "PMS_USER",
      actorId: reconciledBy ?? null,
      entityType: "COMPANION",
      entityId: medRec.id,
      metadata: {
        homeMedCount: rest.homeMedications.length,
        hospitalOrderCount: rest.hospitalOrders.length,
      },
    });

    return medRec;
  },

  async get(id: string, organisationId: string) {
    return assertMedRec(id, organisationId);
  },

  async list(params: ListMedRecParams) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.medicationReconciliation.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
      },
      select: medRecSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdateMedRecParams) {
    const existing = await assertMedRec(id, organisationId);
    if (
      existing.status === "COMPLETED" ||
      existing.status === "PENDING_REVIEW"
    ) {
      throw new MedicationReconciliationError(
        "Cannot edit a completed or pending-review reconciliation.",
        409,
      );
    }

    const data: Prisma.MedicationReconciliationUpdateInput = {};
    if (params.homeMedications !== undefined)
      data.homeMedications =
        params.homeMedications as unknown as Prisma.InputJsonValue;
    if (params.hospitalOrders !== undefined)
      data.hospitalOrders =
        params.hospitalOrders as unknown as Prisma.InputJsonValue;
    if (params.discrepancies !== undefined)
      data.discrepancies =
        params.discrepancies as unknown as Prisma.InputJsonValue;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.medicationReconciliation.update({
      where: { id },
      data,
      select: medRecSelect,
    });
  },

  async complete(
    id: string,
    organisationId: string,
    params: CompleteMedRecParams,
    completedBy?: string,
  ) {
    await assertMedRec(id, organisationId);

    const updated = await prisma.medicationReconciliation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        reconciledBy: completedBy ?? null,
        reconciledAt: new Date(),
        ...(params.discrepancies
          ? {
              discrepancies:
                params.discrepancies as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
      select: medRecSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: updated.patientId,
      eventType: "MEDICATION_RECONCILIATION_COMPLETED",
      actorType: "PMS_USER",
      actorId: completedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async review(
    id: string,
    organisationId: string,
    params: ReviewMedRecParams,
    reviewedBy: string,
  ) {
    const existing = await assertMedRec(id, organisationId);
    if (existing.status !== "COMPLETED") {
      throw new MedicationReconciliationError(
        "Can only review a completed reconciliation.",
        409,
      );
    }

    const updated = await prisma.medicationReconciliation.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: params.reviewNotes ?? null,
      },
      select: medRecSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "MEDICATION_RECONCILIATION_REVIEWED",
      actorType: "PMS_USER",
      actorId: reviewedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },
};
