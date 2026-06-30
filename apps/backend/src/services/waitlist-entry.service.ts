import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class WaitlistEntryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WaitlistEntryError";
  }
}

type WaitlistStatus =
  | "WAITING"
  | "OFFERED"
  | "BOOKED"
  | "CANCELLED"
  | "EXPIRED";

const TERMINAL_STATUSES: WaitlistStatus[] = ["BOOKED", "CANCELLED", "EXPIRED"];

export interface AddWaitlistParams {
  organisationId: string;
  patientId: string;
  requestedBy?: string;
  preferredLeadId?: string;
  appointmentType?: string;
  earliestDate?: Date;
  latestDate?: Date;
  notes?: string;
  expiresAt?: Date;
}

const waitlistSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  requestedBy: true,
  preferredLeadId: true,
  appointmentType: true,
  earliestDate: true,
  latestDate: true,
  notes: true,
  status: true,
  offeredAt: true,
  bookedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WaitlistEntrySelect;

const assertEntry = async (id: string, organisationId: string) => {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id, organisationId },
    select: waitlistSelect,
  });
  if (!entry) throw new WaitlistEntryError("Waitlist entry not found.", 404);
  return entry;
};

export const WaitlistEntryService = {
  async add(params: AddWaitlistParams) {
    const entry = await prisma.waitlistEntry.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        requestedBy: params.requestedBy ?? null,
        preferredLeadId: params.preferredLeadId ?? null,
        appointmentType: params.appointmentType ?? null,
        earliestDate: params.earliestDate ?? null,
        latestDate: params.latestDate ?? null,
        notes: params.notes ?? null,
        expiresAt: params.expiresAt ?? null,
        status: "WAITING",
      },
      select: waitlistSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "WAITLIST_ENTRY_ADDED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: { appointmentType: params.appointmentType },
    });

    return entry;
  },

  async get(id: string, organisationId: string) {
    return assertEntry(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    status?: WaitlistStatus;
    appointmentType?: string;
  }) {
    const { organisationId, patientId, status, appointmentType } = params;
    return prisma.waitlistEntry.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(appointmentType ? { appointmentType } : {}),
      },
      select: waitlistSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  async offer(id: string, organisationId: string, offeredAt?: Date) {
    const existing = await assertEntry(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as WaitlistStatus)) {
      throw new WaitlistEntryError(
        `Cannot offer a waitlist entry with status ${existing.status}.`,
        409,
      );
    }
    const entry = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "OFFERED", offeredAt: offeredAt ?? new Date() },
      select: waitlistSelect,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "WAITLIST_ENTRY_OFFERED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {},
    });
    return entry;
  },

  async book(id: string, organisationId: string, bookedAt?: Date) {
    const existing = await assertEntry(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as WaitlistStatus)) {
      throw new WaitlistEntryError(
        `Cannot book a waitlist entry with status ${existing.status}.`,
        409,
      );
    }
    const entry = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "BOOKED", bookedAt: bookedAt ?? new Date() },
      select: waitlistSelect,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "WAITLIST_ENTRY_BOOKED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {},
    });
    return entry;
  },

  async cancel(id: string, organisationId: string) {
    const existing = await assertEntry(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as WaitlistStatus)) {
      throw new WaitlistEntryError(
        `Cannot cancel a waitlist entry with status ${existing.status}.`,
        409,
      );
    }
    const entry = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: waitlistSelect,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "WAITLIST_ENTRY_CANCELLED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {},
    });
    return entry;
  },

  async expire(id: string, organisationId: string) {
    const existing = await assertEntry(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as WaitlistStatus)) {
      throw new WaitlistEntryError(
        `Cannot expire a waitlist entry with status ${existing.status}.`,
        409,
      );
    }
    const entry = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "EXPIRED" },
      select: waitlistSelect,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "WAITLIST_ENTRY_EXPIRED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {},
    });
    return entry;
  },
};
