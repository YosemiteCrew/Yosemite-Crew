import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { Prisma } from "@prisma/client";

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

const assertScheduledTransition = async (
  id: string,
  organisationId: string,
  next: Exclude<MARStatus, "SCHEDULED">,
) => {
  const entry = await assertMAREntry(id, organisationId);
  guardTransition(entry.status, next);
  return entry;
};

const throwTransitionConflict = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new MARError("MAR entry has already been updated.", 409);
  }
  throw error;
};

const updateTransition = async <T>(update: () => Promise<T>): Promise<T> => {
  try {
    return await update();
  } catch (error) {
    return throwTransitionConflict(error);
  }
};

type CloseMAREntryParams = {
  id: string;
  organisationId: string;
  status: "HELD" | "MISSED" | "REFUSED";
  eventType: "MAR_ENTRY_HELD" | "MAR_ENTRY_MISSED" | "MAR_ENTRY_REFUSED";
  notes?: string;
  actorId?: string;
};

const closeMAREntry = async ({
  id,
  organisationId,
  status,
  eventType,
  notes,
  actorId,
}: CloseMAREntryParams) => {
  const entry = await assertScheduledTransition(id, organisationId, status);
  const updated = await updateTransition(() =>
    prisma.mAREntry.update({
      where: { id, organisationId, status: "SCHEDULED" },
      data: { status, notes: notes ?? null },
      select: marSelect,
    }),
  );

  await AuditTrailService.recordSafely({
    organisationId,
    patientId: entry.patientId,
    eventType,
    actorType: "PMS_USER",
    actorId: actorId ?? null,
    entityType: "COMPANION",
    entityId: id,
    metadata: { medicationName: entry.medicationName, notes: notes ?? null },
  });

  return updated;
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

  list(params: ListMAREntriesParams) {
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
    const entry = await assertScheduledTransition(id, organisationId, "GIVEN");
    const updated = await updateTransition(() =>
      prisma.mAREntry.update({
        where: { id, organisationId, status: "SCHEDULED" },
        data: {
          status: "GIVEN",
          administeredAt: params.administeredAt ?? new Date(),
          administeredBy: params.administeredBy ?? null,
          notes: params.notes ?? null,
        },
        select: marSelect,
      }),
    );

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
    return closeMAREntry({
      id,
      organisationId,
      status: "HELD",
      eventType: "MAR_ENTRY_HELD",
      actorId: heldBy,
      notes,
    });
  },

  async markMissed(
    id: string,
    organisationId: string,
    notes: string | undefined,
    actorId?: string,
  ) {
    return closeMAREntry({
      id,
      organisationId,
      status: "MISSED",
      eventType: "MAR_ENTRY_MISSED",
      actorId,
      notes,
    });
  },

  async refuse(
    id: string,
    organisationId: string,
    notes: string | undefined,
    actorId?: string,
  ) {
    return closeMAREntry({
      id,
      organisationId,
      status: "REFUSED",
      eventType: "MAR_ENTRY_REFUSED",
      actorId,
      notes,
    });
  },
};
