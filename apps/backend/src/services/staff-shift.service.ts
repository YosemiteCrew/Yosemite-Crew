import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class StaffShiftError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "StaffShiftError";
  }
}

type ShiftStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

const TERMINAL_STATUSES: ShiftStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export interface CreateShiftParams {
  organisationId: string;
  staffId: string;
  role: string;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  breakMinutes?: number;
  notes?: string;
  createdBy?: string;
}

const shiftSelect = {
  id: true,
  organisationId: true,
  staffId: true,
  role: true,
  shiftDate: true,
  startTime: true,
  endTime: true,
  breakMinutes: true,
  status: true,
  notes: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffShiftSelect;

const assertShift = async (id: string, organisationId: string) => {
  const shift = await prisma.staffShift.findFirst({
    where: { id, organisationId },
    select: shiftSelect,
  });
  if (!shift) throw new StaffShiftError("Staff shift not found.", 404);
  return shift;
};

export const StaffShiftService = {
  async schedule(params: CreateShiftParams) {
    if (params.endTime <= params.startTime) {
      throw new StaffShiftError(
        "Shift end time must be after start time.",
        400,
      );
    }

    const shift = await prisma.staffShift.create({
      data: {
        organisationId: params.organisationId,
        staffId: params.staffId,
        role: params.role,
        shiftDate: params.shiftDate,
        startTime: params.startTime,
        endTime: params.endTime,
        breakMinutes: params.breakMinutes ?? null,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
        status: "SCHEDULED",
      },
      select: shiftSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: "",
      eventType: "STAFF_SHIFT_SCHEDULED",
      actorType: "PMS_USER",
      actorId: params.createdBy ?? null,
      entityType: "COMPANION",
      entityId: params.staffId,
      metadata: {
        shiftId: shift.id,
        role: params.role,
        shiftDate: params.shiftDate.toISOString(),
      },
    });

    return shift;
  },

  async get(id: string, organisationId: string) {
    return assertShift(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    staffId?: string;
    role?: string;
    status?: ShiftStatus;
    date?: Date;
  }) {
    const { organisationId, staffId, role, status, date } = params;
    let dateFilter = {};
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      dateFilter = { shiftDate: { gte: start, lte: end } };
    }

    return prisma.staffShift.findMany({
      where: {
        organisationId,
        ...(staffId ? { staffId } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...dateFilter,
      },
      select: shiftSelect,
      orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: {
      role?: string;
      shiftDate?: Date;
      startTime?: Date;
      endTime?: Date;
      breakMinutes?: number;
      notes?: string;
      updatedBy?: string;
    },
  ) {
    const existing = await assertShift(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as ShiftStatus)) {
      throw new StaffShiftError(
        `Cannot update a shift with status ${existing.status}.`,
        409,
      );
    }

    const startTime = params.startTime ?? existing.startTime;
    const endTime = params.endTime ?? existing.endTime;
    if (endTime <= startTime) {
      throw new StaffShiftError(
        "Shift end time must be after start time.",
        400,
      );
    }

    const shift = await prisma.staffShift.update({
      where: { id },
      data: {
        ...(params.role ? { role: params.role } : {}),
        ...(params.shiftDate ? { shiftDate: params.shiftDate } : {}),
        ...(params.startTime ? { startTime: params.startTime } : {}),
        ...(params.endTime ? { endTime: params.endTime } : {}),
        ...(params.breakMinutes !== undefined
          ? { breakMinutes: params.breakMinutes }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
      },
      select: shiftSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "STAFF_SHIFT_UPDATED",
      actorType: "PMS_USER",
      actorId: params.updatedBy ?? null,
      entityType: "COMPANION",
      entityId: existing.staffId,
      metadata: { shiftId: id },
    });

    return shift;
  },

  async start(id: string, organisationId: string) {
    const existing = await assertShift(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as ShiftStatus)) {
      throw new StaffShiftError(
        `Cannot start a shift with status ${existing.status}.`,
        409,
      );
    }
    return prisma.staffShift.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
      select: shiftSelect,
    });
  },

  async complete(id: string, organisationId: string) {
    const existing = await assertShift(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as ShiftStatus)) {
      throw new StaffShiftError(
        `Cannot complete a shift with status ${existing.status}.`,
        409,
      );
    }
    return prisma.staffShift.update({
      where: { id },
      data: { status: "COMPLETED" },
      select: shiftSelect,
    });
  },

  async cancel(id: string, organisationId: string, cancelledBy?: string) {
    const existing = await assertShift(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as ShiftStatus)) {
      throw new StaffShiftError(
        `Cannot cancel a shift with status ${existing.status}.`,
        409,
      );
    }

    const shift = await prisma.staffShift.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: shiftSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "STAFF_SHIFT_CANCELLED",
      actorType: "PMS_USER",
      actorId: cancelledBy ?? null,
      entityType: "COMPANION",
      entityId: existing.staffId,
      metadata: { shiftId: id },
    });

    return shift;
  },

  async markNoShow(id: string, organisationId: string) {
    const existing = await assertShift(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as ShiftStatus)) {
      throw new StaffShiftError(
        `Cannot mark no-show for a shift with status ${existing.status}.`,
        409,
      );
    }
    return prisma.staffShift.update({
      where: { id },
      data: { status: "NO_SHOW" },
      select: shiftSelect,
    });
  },
};
