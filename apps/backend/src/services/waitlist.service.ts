import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";
import { NotificationService } from "./notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

export class WaitlistError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WaitlistError";
  }
}

export interface AddToWaitlistParams {
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

export interface ListWaitlistParams {
  organisationId: string;
  status?: "WAITING" | "OFFERED" | "BOOKED" | "CANCELLED" | "EXPIRED";
  patientId?: string;
  appointmentType?: string;
}

const entrySelect = {
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
    select: entrySelect,
  });
  if (!entry) {
    throw new WaitlistError("Waitlist entry not found.", 404);
  }
  return entry;
};

const notifyOwnerOfSlot = async (patientId: string): Promise<void> => {
  try {
    const link = await prisma.parentPatient.findFirst({
      where: { patientId, role: "PRIMARY", status: "ACTIVE" },
      select: { parentId: true },
    });
    if (!link) return;

    const [parent, patient] = await Promise.all([
      prisma.parent.findUnique({
        where: { id: link.parentId },
        select: { linkedUserId: true, email: true },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { name: true },
      }),
    ]);

    if (!parent || !patient) return;

    const payload = NotificationTemplates.Care.WAITLIST_SLOT_AVAILABLE(
      patient.name,
    );

    if (parent.linkedUserId) {
      await NotificationService.sendToUser(parent.linkedUserId, payload).catch(
        () => undefined,
      );
    }
    if (parent.email) {
      await sendEmail({
        to: parent.email,
        subject: payload.title,
        htmlBody: `<p>${payload.body}</p>`,
      }).catch(() => undefined);
    }
  } catch (err) {
    logger.error("notifyOwnerOfSlot failed", { patientId, err });
  }
};

export const WaitlistService = {
  async add(params: AddToWaitlistParams) {
    const {
      organisationId,
      patientId,
      requestedBy,
      preferredLeadId,
      appointmentType,
      earliestDate,
      latestDate,
      notes,
      expiresAt,
    } = params;

    const entry = await prisma.waitlistEntry.create({
      data: {
        organisationId,
        patientId,
        requestedBy: requestedBy ?? null,
        preferredLeadId: preferredLeadId ?? null,
        appointmentType: appointmentType ?? null,
        earliestDate: earliestDate ?? null,
        latestDate: latestDate ?? null,
        notes: notes ?? null,
        status: "WAITING",
        expiresAt: expiresAt ?? null,
      },
      select: entrySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "WAITLIST_ENTRY_ADDED",
      actorType: "PMS_USER",
      actorId: requestedBy ?? null,
      entityType: "APPOINTMENT",
      entityId: entry.id,
      metadata: { appointmentType, preferredLeadId },
    });

    return entry;
  },

  async get(id: string, organisationId: string) {
    return assertEntry(id, organisationId);
  },

  async list(params: ListWaitlistParams) {
    const { organisationId, status, patientId, appointmentType } = params;
    return prisma.waitlistEntry.findMany({
      where: {
        organisationId,
        ...(status ? { status } : {}),
        ...(patientId ? { patientId } : {}),
        ...(appointmentType ? { appointmentType } : {}),
      },
      select: entrySelect,
      orderBy: { createdAt: "asc" },
    });
  },

  async offer(id: string, organisationId: string, offeredBy?: string) {
    const entry = await assertEntry(id, organisationId);
    if (entry.status !== "WAITING") {
      throw new WaitlistError(
        "Only WAITING entries can be offered a slot.",
        409,
      );
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "OFFERED", offeredAt: new Date() },
      select: entrySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "WAITLIST_ENTRY_OFFERED",
      actorType: "PMS_USER",
      actorId: offeredBy ?? null,
      entityType: "APPOINTMENT",
      entityId: id,
      metadata: {},
    });

    void notifyOwnerOfSlot(entry.patientId);

    return updated;
  },

  async book(id: string, organisationId: string, bookedBy?: string) {
    const entry = await assertEntry(id, organisationId);
    if (entry.status !== "OFFERED" && entry.status !== "WAITING") {
      throw new WaitlistError(
        "Only WAITING or OFFERED entries can be booked.",
        409,
      );
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "BOOKED", bookedAt: new Date() },
      select: entrySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "WAITLIST_ENTRY_BOOKED",
      actorType: "PMS_USER",
      actorId: bookedBy ?? null,
      entityType: "APPOINTMENT",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async cancel(id: string, organisationId: string, cancelledBy?: string) {
    const entry = await assertEntry(id, organisationId);
    if (entry.status === "CANCELLED" || entry.status === "EXPIRED") {
      throw new WaitlistError("Entry is already closed.", 409);
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: entrySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: entry.patientId,
      eventType: "WAITLIST_ENTRY_CANCELLED",
      actorType: "PMS_USER",
      actorId: cancelledBy ?? null,
      entityType: "APPOINTMENT",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async expireStale(organisationId: string) {
    const now = new Date();
    const result = await prisma.waitlistEntry.updateMany({
      where: {
        organisationId,
        status: "WAITING",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
    return { expired: result.count };
  },

  async notifyOnCancellation(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        organisationId: true,
        appointmentDate: true,
        appointmentType: true,
        status: true,
      },
    });
    if (!appointment || appointment.status !== "CANCELLED") return;

    const apptDate = appointment.appointmentDate;
    const dayStart = new Date(apptDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(apptDate);
    dayEnd.setHours(23, 59, 59, 999);

    const waiting = await prisma.waitlistEntry.findMany({
      where: {
        organisationId: appointment.organisationId,
        status: "WAITING",
        OR: [
          { earliestDate: null },
          {
            AND: [
              { earliestDate: { lte: dayEnd } },
              { latestDate: { gte: dayStart } },
            ],
          },
          { earliestDate: { lte: dayEnd }, latestDate: null },
        ],
      },
      select: entrySelect,
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    for (const entry of waiting) {
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: "OFFERED", offeredAt: new Date() },
      });
      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        patientId: entry.patientId,
        eventType: "WAITLIST_ENTRY_OFFERED",
        actorType: "SYSTEM",
        actorId: null,
        entityType: "APPOINTMENT",
        entityId: entry.id,
        metadata: { triggeredBy: appointmentId },
      });
      void notifyOwnerOfSlot(entry.patientId);
    }

    return { notified: waiting.length };
  },
};
