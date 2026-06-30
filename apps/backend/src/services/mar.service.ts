import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class MARError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MARError";
  }
}

type MARStatus = "SCHEDULED" | "GIVEN" | "HELD" | "MISSED" | "REFUSED";

export interface CreateMAREntryParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  prescriptionId?: string;
  medicationName: string;
  dose: string;
  route: string;
  scheduledAt: Date;
  createdBy?: string;
}

export interface AdministerMAREntryParams {
  administeredAt?: Date;
  administeredBy?: string;
  notes?: string;
}

export interface ListMAREntriesParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  status?: MARStatus;
  from?: Date;
  to?: Date;
}

const marSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  prescriptionId: true,
  medicationName: true,
  dose: true,
  route: true,
  scheduledAt: true,
  administeredAt: true,
  administeredBy: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MAREntrySelect;

const assertMAREntry = async (id: string, organisationId: string) => {
  const entry = await prisma.mAREntry.findFirst({
    where: { id, organisationId },
    select: marSelect,
  });
  if (!entry) {
    throw new MARError("MAR entry not found.", 404);
  }
  return entry;
};

const guardTransition = (current: MARStatus, next: MARStatus) => {
  if (current !== "SCHEDULED") {
    throw new MARError(
      `Cannot transition from ${current} to ${next} — entry is already closed.`,
      409,
    );
  }
};

export const MARService = {
  async create(params: CreateMAREntryParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      prescriptionId,
      medicationName,
      dose,
      route,
      scheduledAt,
      createdBy,
    } = params;

    const entry = await prisma.mAREntry.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        prescriptionId: prescriptionId ?? null,
        medicationName,
        dose,
        route,
        scheduledAt,
        status: "SCHEDULED",
      },
      select: marSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "MAR_ENTRY_CREATED",
      actorType: "PMS_USER",
      actorId: createdBy ?? null,
      entityType: "COMPANION",
      entityId: entry.id,
      metadata: { medicationName, dose, route, scheduledAt },
    });

    return entry;
  },

  async get(id: string, organisationId: string) {
    return assertMAREntry(id, organisationId);
  },

  async list(params: ListMAREntriesParams) {
    const { organisationId, patientId, encounterId, status, from, to } = params;
    return prisma.mAREntry.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: marSelect,
      orderBy: { scheduledAt: "asc" },
    });
  },

  async administer(
    id: string,
    organisationId: string,
    params: AdministerMAREntryParams,
  ) {
    const entry = await assertMAREntry(id, organisationId);
    guardTransition(entry.status as MARStatus, "GIVEN");

    const updated = await prisma.mAREntry.update({
      where: { id },
      data: {
        status: "GIVEN",
        administeredAt: params.administeredAt ?? new Date(),
        administeredBy: params.administeredBy ?? null,
        notes: params.notes ?? null,
      },
      select: marSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "MAR_ENTRY_ADMINISTERED",
      actorType: "PMS_USER",
      actorId: params.administeredBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { medicationName: entry.medicationName },
    });

    return updated;
  },

  async hold(
    id: string,
    organisationId: string,
    notes: string | undefined,
    heldBy?: string,
  ) {
    const entry = await assertMAREntry(id, organisationId);
    guardTransition(entry.status as MARStatus, "HELD");

    const updated = await prisma.mAREntry.update({
      where: { id },
      data: { status: "HELD", notes: notes ?? null },
      select: marSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "MAR_ENTRY_HELD",
      actorType: "PMS_USER",
      actorId: heldBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { medicationName: entry.medicationName, notes: notes ?? null },
    });

    return updated;
  },

  async markMissed(
    id: string,
    organisationId: string,
    notes: string | undefined,
    actorId?: string,
  ) {
    const entry = await assertMAREntry(id, organisationId);
    guardTransition(entry.status as MARStatus, "MISSED");

    const updated = await prisma.mAREntry.update({
      where: { id },
      data: { status: "MISSED", notes: notes ?? null },
      select: marSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "MAR_ENTRY_MISSED",
      actorType: "PMS_USER",
      actorId: actorId ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { medicationName: entry.medicationName },
    });

    return updated;
  },
};
