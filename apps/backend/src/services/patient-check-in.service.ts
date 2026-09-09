import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "./appointment.prisma.service";
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
  "IMMEDIATE" | "URGENT" | "LESS_URGENT" | "STANDARD" | "NON_URGENT";

type CheckInStatus =
  "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

const TERMINAL_STATUSES = new Set<CheckInStatus>([
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

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

/**
 * The front desk's arrival and the schedule's own CHECKED_IN status are two
 * independent state machines (PatientCheckIn.status vs Appointment.status)
 * that happened to grow the same vocabulary without ever being wired
 * together: checking a patient in here never touched the linked appointment,
 * so the Board kept showing "Upcoming" for a patient the front desk already
 * had as arrived. This is the one write that closes that gap - reusing
 * `checkInAppointment` (not a raw status write) so the encounter it creates
 * on arrival still gets created.
 *
 * Deliberately best-effort: an appointment already CHECKED_IN or further
 * along (IN_PROGRESS, COMPLETED, ...) throws on the transition, and a
 * walk-in's appointmentId can point at a REQUESTED or CANCELLED appointment
 * that was never confirmed - none of those should block the front desk from
 * recording that someone physically arrived.
 */
const syncAppointmentOnArrival = async (
  appointmentId: string | undefined,
  organisationId: string,
): Promise<void> => {
  if (!appointmentId) return;
  try {
    await AppointmentPrismaService.checkInAppointment(
      appointmentId,
      organisationId,
    );
  } catch (err) {
    if (err instanceof AppointmentPrismaServiceError) return;
    throw err;
  }
};

/**
 * Front desk's "current room" and the schedule's own Appointment.room are
 * the same fact tracked in two places: reassigning a room at check-in never
 * touched the appointment, so the Board kept showing whatever room the
 * appointment was booked into even after the patient moved. Best-effort for
 * the same reason as syncAppointmentOnArrival - a check-in isn't always
 * linked to an appointment, and a stale/terminal appointment shouldn't block
 * the front desk from recording a room move.
 */
const syncAppointmentRoom = async (
  appointmentId: string | undefined,
  organisationId: string,
  roomId: string,
): Promise<void> => {
  if (!appointmentId) return;
  const room = await prisma.organisationRoom.findFirst({
    where: { id: roomId, organisationId },
    select: { id: true, name: true },
  });
  if (!room) return;
  try {
    await AppointmentPrismaService.updateAppointmentRoom(
      appointmentId,
      organisationId,
      room,
    );
  } catch (err) {
    if (err instanceof AppointmentPrismaServiceError) return;
    throw err;
  }
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

    await syncAppointmentOnArrival(params.appointmentId, params.organisationId);

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
    if (TERMINAL_STATUSES.has(existing.status)) {
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
    if (TERMINAL_STATUSES.has(existing.status)) {
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
    if (TERMINAL_STATUSES.has(existing.status)) {
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
    if (TERMINAL_STATUSES.has(existing.status)) {
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
    const existing = await assertCheckIn(id, organisationId);
    const record = await prisma.patientCheckIn.update({
      where: { id },
      data: { assignedRoomId: roomId },
      select: checkInSelect,
    });

    await syncAppointmentRoom(
      existing.appointmentId ?? undefined,
      organisationId,
      roomId,
    );

    return record;
  },
};
