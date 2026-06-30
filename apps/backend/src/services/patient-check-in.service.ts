import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientCheckInError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientCheckInError";
  }
}

type TriagePriority =
  | "IMMEDIATE"
  | "URGENT"
  | "LESS_URGENT"
  | "STANDARD"
  | "NON_URGENT";

type CheckInStatus =
  | "WAITING"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

const TERMINAL_STATUSES: CheckInStatus[] = [
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

export interface CreateCheckInParams {
  organisationId: string;
  patientId: string;
  clientId: string;
  appointmentId?: string;
  arrivedAt: Date;
  triagePriority?: TriagePriority;
  triageNote?: string;
  checkedInBy?: string;
  notes?: string;
}

const checkInSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  clientId: true,
  appointmentId: true,
  arrivedAt: true,
  triagePriority: true,
  triageNote: true,
  assignedRoomId: true,
  checkedInBy: true,
  waitStartedAt: true,
  seenAt: true,
  waitMinutes: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientCheckInSelect;

const assertCheckIn = async (id: string, organisationId: string) => {
  const record = await prisma.patientCheckIn.findFirst({
    where: { id, organisationId },
    select: checkInSelect,
  });
  if (!record) throw new PatientCheckInError("Check-in record not found.", 404);
  return record;
};

export const PatientCheckInService = {
  async create(params: CreateCheckInParams) {
    const record = await prisma.patientCheckIn.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        clientId: params.clientId,
        appointmentId: params.appointmentId ?? null,
        arrivedAt: params.arrivedAt,
        triagePriority: params.triagePriority ?? "NON_URGENT",
        triageNote: params.triageNote ?? null,
        checkedInBy: params.checkedInBy ?? null,
        waitStartedAt: new Date(),
        status: "WAITING",
        notes: params.notes ?? null,
      },
      select: checkInSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "PATIENT_CHECKED_IN",
      actorType: "PMS_USER",
      actorId: params.checkedInBy ?? null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        checkInId: record.id,
        triagePriority: record.triagePriority,
        appointmentId: params.appointmentId ?? null,
      },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertCheckIn(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    status?: CheckInStatus;
    date?: Date;
  }) {
    const { organisationId, patientId, status, date } = params;
    let arrivedAtFilter = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      arrivedAtFilter = { arrivedAt: { gte: startOfDay, lte: endOfDay } };
    }

    return prisma.patientCheckIn.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...arrivedAtFilter,
      },
      select: checkInSelect,
      orderBy: { arrivedAt: "asc" },
    });
  },

  async markSeen(id: string, organisationId: string) {
    const existing = await assertCheckIn(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as CheckInStatus)) {
      throw new PatientCheckInError(
        `Cannot mark as seen a check-in with status ${existing.status}.`,
        409,
      );
    }

    const seenAt = new Date();
    const waitMinutes = existing.waitStartedAt
      ? Math.round(
          (seenAt.getTime() - new Date(existing.waitStartedAt).getTime()) /
            60000,
        )
      : null;

    const record = await prisma.patientCheckIn.update({
      where: { id },
      data: {
        status: "IN_CONSULTATION",
        seenAt,
        waitMinutes,
      },
      select: checkInSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "PATIENT_SEEN",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: { checkInId: id, waitMinutes },
    });

    return record;
  },

  async complete(id: string, organisationId: string) {
    const existing = await assertCheckIn(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as CheckInStatus)) {
      throw new PatientCheckInError(
        `Cannot complete a check-in with status ${existing.status}.`,
        409,
      );
    }
    return prisma.patientCheckIn.update({
      where: { id },
      data: { status: "COMPLETED" },
      select: checkInSelect,
    });
  },

  async cancel(id: string, organisationId: string) {
    const existing = await assertCheckIn(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as CheckInStatus)) {
      throw new PatientCheckInError(
        `Cannot cancel a check-in with status ${existing.status}.`,
        409,
      );
    }
    return prisma.patientCheckIn.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: checkInSelect,
    });
  },

  async markNoShow(id: string, organisationId: string) {
    const existing = await assertCheckIn(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as CheckInStatus)) {
      throw new PatientCheckInError(
        `Cannot mark no-show for a check-in with status ${existing.status}.`,
        409,
      );
    }
    return prisma.patientCheckIn.update({
      where: { id },
      data: { status: "NO_SHOW" },
      select: checkInSelect,
    });
  },

  async assignRoom(id: string, organisationId: string, roomId: string) {
    await assertCheckIn(id, organisationId);
    return prisma.patientCheckIn.update({
      where: { id },
      data: { assignedRoomId: roomId },
      select: checkInSelect,
    });
  },
};
