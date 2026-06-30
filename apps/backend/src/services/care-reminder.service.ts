import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { NotificationService } from "./notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";
import type { Prisma } from "@prisma/client";

export class CareReminderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CareReminderError";
  }
}

type ReminderType =
  | "VACCINATION_BOOSTER"
  | "ANNUAL_CHECKUP"
  | "PARASITE_TREATMENT"
  | "DENTAL_CLEANING"
  | "FOLLOW_UP"
  | "CUSTOM";

type ReminderStatus =
  | "PENDING"
  | "SENT"
  | "RESPONDED"
  | "EXPIRED"
  | "CANCELLED";

const CARE_TYPE_LABELS: Record<ReminderType, string> = {
  VACCINATION_BOOSTER: "a vaccination booster",
  ANNUAL_CHECKUP: "an annual health check",
  PARASITE_TREATMENT: "parasite treatment",
  DENTAL_CLEANING: "a dental cleaning",
  FOLLOW_UP: "a follow-up appointment",
  CUSTOM: "a scheduled care appointment",
};

export interface CreateCareReminderParams {
  organisationId: string;
  patientId: string;
  reminderType: ReminderType;
  customMessage?: string;
  dueDate: Date;
  sendAt?: Date;
  notes?: string;
  createdBy?: string;
}

export interface BulkCreateCareReminderParams {
  organisationId: string;
  patientIds: string[];
  reminderType: ReminderType;
  customMessage?: string;
  dueDate: Date;
  sendAt?: Date;
  createdBy?: string;
}

export interface ListCareRemindersParams {
  organisationId: string;
  patientId?: string;
  status?: ReminderStatus;
  reminderType?: ReminderType;
  dueBefore?: Date;
  dueAfter?: Date;
}

const reminderSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  reminderType: true,
  customMessage: true,
  dueDate: true,
  sendAt: true,
  status: true,
  sentAt: true,
  respondedAt: true,
  appointmentId: true,
  notes: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CareReminderSelect;

const assertReminder = async (id: string, organisationId: string) => {
  const reminder = await prisma.careReminder.findFirst({
    where: { id, organisationId },
    select: reminderSelect,
  });
  if (!reminder) {
    throw new CareReminderError("Care reminder not found.", 404);
  }
  return reminder;
};

const dispatchNotification = async (
  reminder: Awaited<ReturnType<typeof assertReminder>>,
  patientName: string,
  ownerUserId: string | null,
  ownerEmail: string | null,
) => {
  const typeLabel =
    CARE_TYPE_LABELS[reminder.reminderType as ReminderType] ?? "care";
  const body =
    reminder.customMessage ??
    `${patientName} is due for ${typeLabel}. Please book an appointment at your earliest convenience.`;

  if (ownerUserId) {
    const payload = NotificationTemplates.Care.CARE_REMINDER(
      patientName,
      typeLabel,
    );
    await NotificationService.sendToUser(ownerUserId, payload).catch(
      (err: unknown) => {
        logger.error("Care reminder push notification failed", {
          reminderId: reminder.id,
          err,
        });
      },
    );
  }

  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `Care reminder for ${patientName}`,
      htmlBody: `<p>${body}</p><p>Book an appointment through the app or contact your clinic directly.</p>`,
    }).catch((err: unknown) => {
      logger.error("Care reminder email failed", {
        reminderId: reminder.id,
        err,
      });
    });
  }
};

export const CareReminderService = {
  async create(params: CreateCareReminderParams) {
    const {
      organisationId,
      patientId,
      reminderType,
      customMessage,
      dueDate,
      sendAt,
      notes,
      createdBy,
    } = params;

    const reminder = await prisma.careReminder.create({
      data: {
        organisationId,
        patientId,
        reminderType,
        customMessage: customMessage ?? null,
        dueDate,
        sendAt: sendAt ?? null,
        notes: notes ?? null,
        createdBy: createdBy ?? null,
        status: "PENDING",
      },
      select: reminderSelect,
    });

    return reminder;
  },

  async bulkCreate(params: BulkCreateCareReminderParams) {
    const {
      organisationId,
      patientIds,
      reminderType,
      customMessage,
      dueDate,
      sendAt,
      createdBy,
    } = params;

    if (patientIds.length === 0) {
      throw new CareReminderError("At least one patientId is required.", 400);
    }
    if (patientIds.length > 200) {
      throw new CareReminderError(
        "Bulk create is limited to 200 patients per call.",
        400,
      );
    }

    const data = patientIds.map((patientId) => ({
      organisationId,
      patientId,
      reminderType,
      customMessage: customMessage ?? null,
      dueDate,
      sendAt: sendAt ?? null,
      createdBy: createdBy ?? null,
      status: "PENDING" as const,
      updatedAt: new Date(),
    }));

    const result = await prisma.careReminder.createMany({ data });
    return { created: result.count };
  },

  async get(id: string, organisationId: string) {
    return assertReminder(id, organisationId);
  },

  async list(params: ListCareRemindersParams) {
    const {
      organisationId,
      patientId,
      status,
      reminderType,
      dueBefore,
      dueAfter,
    } = params;
    return prisma.careReminder.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(reminderType ? { reminderType } : {}),
        ...(dueBefore || dueAfter
          ? {
              dueDate: {
                ...(dueBefore ? { lte: dueBefore } : {}),
                ...(dueAfter ? { gte: dueAfter } : {}),
              },
            }
          : {}),
      },
      select: reminderSelect,
      orderBy: { dueDate: "asc" },
    });
  },

  async send(id: string, organisationId: string, sentBy?: string) {
    const reminder = await assertReminder(id, organisationId);
    if (reminder.status !== "PENDING") {
      throw new CareReminderError(
        `Cannot send a ${reminder.status} reminder.`,
        409,
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: reminder.patientId },
      select: { name: true },
    });
    const patientName = patient?.name ?? "your pet";

    const link = await prisma.parentPatient.findFirst({
      where: {
        patientId: reminder.patientId,
        role: "PRIMARY",
        status: "ACTIVE",
      },
      select: { parentId: true },
    });
    let ownerUserId: string | null = null;
    let ownerEmail: string | null = null;
    if (link) {
      const parent = await prisma.parent.findUnique({
        where: { id: link.parentId },
        select: { linkedUserId: true, email: true },
      });
      ownerUserId = parent?.linkedUserId ?? null;
      ownerEmail = parent?.email ?? null;
    }

    await dispatchNotification(reminder, patientName, ownerUserId, ownerEmail);

    const updated = await prisma.careReminder.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      select: reminderSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: reminder.patientId,
      eventType: "CARE_REMINDER_SENT",
      actorType: "PMS_USER",
      actorId: sentBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        reminderType: reminder.reminderType,
        dueDate: reminder.dueDate,
      },
    });

    return updated;
  },

  async markResponded(
    id: string,
    organisationId: string,
    appointmentId?: string,
    respondedBy?: string,
  ) {
    const reminder = await assertReminder(id, organisationId);
    if (reminder.status !== "SENT" && reminder.status !== "PENDING") {
      throw new CareReminderError(
        `Cannot mark a ${reminder.status} reminder as responded.`,
        409,
      );
    }

    const updated = await prisma.careReminder.update({
      where: { id },
      data: {
        status: "RESPONDED",
        respondedAt: new Date(),
        ...(appointmentId ? { appointmentId } : {}),
      },
      select: reminderSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: reminder.patientId,
      eventType: "CARE_REMINDER_RESPONDED",
      actorType: "PMS_USER",
      actorId: respondedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { appointmentId },
    });

    return updated;
  },

  async cancel(id: string, organisationId: string, cancelledBy?: string) {
    const reminder = await assertReminder(id, organisationId);
    if (reminder.status === "CANCELLED") {
      throw new CareReminderError("Reminder is already cancelled.", 409);
    }
    if (reminder.status === "RESPONDED") {
      throw new CareReminderError(
        "Cannot cancel a reminder that has been responded to.",
        409,
      );
    }

    const updated = await prisma.careReminder.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: reminderSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: reminder.patientId,
      eventType: "CARE_REMINDER_CANCELLED",
      actorType: "PMS_USER",
      actorId: cancelledBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { fromStatus: reminder.status },
    });

    return updated;
  },
};
