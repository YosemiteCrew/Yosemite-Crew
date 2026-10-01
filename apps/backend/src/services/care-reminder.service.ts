import { prisma } from "src/config/prisma";
import { escapeHtml } from "src/utils/email-templates";
import { AuditTrailService } from "./audit-trail.service";
import { NotificationService, type SendResult } from "./notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { sendEmail } from "src/utils/email";
import {
  buildCareReminderUnsubscribeUrl,
  resolveCareReminderSuppression,
  type CareReminderSuppression,
} from "./care-reminder-opt-out.service";
import logger from "src/utils/logger";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  assertPatientOrgMembership,
  assertPatientsOrgMembership,
} from "./shared/patient-org-membership";
import {
  CARE_TYPE_LABELS,
  buildCareReminderMessage,
} from "./shared/care-reminder-message";

export class CareReminderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CareReminderError";
  }
}

const ReminderScopeSchema = z.object({
  id: z.string().min(1),
  organisationId: z.string().min(1),
});

type ReminderType =
  | "VACCINATION_BOOSTER"
  | "ANNUAL_CHECKUP"
  | "PARASITE_TREATMENT"
  | "DENTAL_CLEANING"
  | "FOLLOW_UP"
  | "CUSTOM";

type ReminderStatus =
  "PENDING" | "SENDING" | "SENT" | "RESPONDED" | "EXPIRED" | "CANCELLED";

type DeliverySummary = { push: ChannelOutcome; email: ChannelOutcome };

const STALE_SEND_CLAIM_MS = 15 * 60 * 1000;
const SCHEDULED_SEND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
  sendingAt: true,
  lastAttemptAt: true,
  lastDelivery: true,
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

/**
 * Everything that can refuse the send, resolved before any channel is delivered.
 *
 * Kept separate from delivery for two reasons: it is the only part that can
 * legally block delivery, and doing it first means a preference/configuration
 * failure cannot leave one channel delivered and the other not. Those failures
 * are recorded as an unsuccessful attempt and remain available for manual retry.
 */
const resolveDeliveryPlan = async (
  reminder: Awaited<ReturnType<typeof assertReminder>>,
  ownerEmail: string | null,
): Promise<{
  suppression: CareReminderSuppression;
  unsubscribeUrl: string | null;
}> => {
  // With no address on file there is no key to look an objection up by, so push
  // is the only channel and it proceeds. Worth knowing when reading suppression
  // numbers: an opt-out is recorded against an email address.
  if (!ownerEmail) {
    return { suppression: { email: false, push: false }, unsubscribeUrl: null };
  }

  let suppression: CareReminderSuppression;
  try {
    suppression = await resolveCareReminderSuppression({
      organisationId: reminder.organisationId,
      email: ownerEmail,
    });
  } catch (err: unknown) {
    logger.error(
      "Care reminder not sent: opt-out lookup failed, cannot prove consent",
      { reminderId: reminder.id, err },
    );
    throw new CareReminderError(
      "Unable to verify reminder preferences right now.",
      503,
    );
  }

  if (suppression.email) {
    return { suppression, unsubscribeUrl: null };
  }

  try {
    return {
      suppression,
      unsubscribeUrl: buildCareReminderUnsubscribeUrl({
        organisationId: reminder.organisationId,
        email: ownerEmail,
      }),
    };
  } catch (err: unknown) {
    logger.error(
      "Care reminder not sent: unsubscribe link could not be built (check PUBLIC_API_URL and MARKETING_UNSUBSCRIBE_SECRET)",
      { reminderId: reminder.id, err },
    );
    throw new CareReminderError(
      "Reminder delivery is not configured correctly.",
      503,
    );
  }
};

const buildReminderEmailBody = (body: string, unsubscribeUrl: string) =>
  // `body` carries the companion name and the reminder's free-text custom
  // message, so it must be escaped before it lands in email markup.
  `<p>${escapeHtml(body)}</p>` +
  `<p>Book an appointment through the app or contact your clinic directly.</p>` +
  `<hr /><p style="font-size:12px;color:#5c5956">` +
  `You are receiving this because your companion is registered with this practice. ` +
  `<a href="${escapeHtml(unsubscribeUrl)}">Stop receiving care reminders from this practice</a>.` +
  `</p>`;

/**
 * What happened on one channel. Only `delivered` and `failed` count as an
 * attempt: `suppressed` is the owner's own opt-out and `unreachable` is no
 * address or device to try, neither of which a retry would change.
 */
type ChannelOutcome = "delivered" | "failed" | "suppressed" | "unreachable";

/**
 * The push is sent with the reminder id as its in-app row id, so a reminder
 * that is still PENDING but already has that row for this owner had an earlier
 * attempt that reached their devices and delivered nothing. If no device is left
 * now, it is because `sendToDevice` deleted the tokens FCM rejected, so this is
 * the same failure again, not an owner with no device, and must not end SENT.
 */
const pushOutcome = async (
  reminderId: string,
  ownerUserId: string,
  results: SendResult[],
): Promise<ChannelOutcome> => {
  if (results.some((result) => result.success)) return "delivered";
  if (results.length) return "failed";
  const earlierAttempt = await prisma.notification.findFirst({
    where: { id: reminderId, userId: ownerUserId },
    select: { id: true },
  });
  return earlierAttempt ? "failed" : "unreachable";
};

const dispatchNotification = async (
  reminder: Awaited<ReturnType<typeof assertReminder>>,
  patientName: string,
  ownerUserId: string | null,
  ownerEmail: string | null,
): Promise<{ push: ChannelOutcome; email: ChannelOutcome }> => {
  const typeLabel = CARE_TYPE_LABELS[reminder.reminderType] ?? "care";
  // Shared with the in-app due list so the two never drift - see
  // `shared/care-reminder-message`.
  const body = buildCareReminderMessage({
    customMessage: reminder.customMessage,
    patientName,
    reminderType: reminder.reminderType,
  });

  const { suppression, unsubscribeUrl } = await resolveDeliveryPlan(
    reminder,
    ownerEmail,
  );

  const suppressed = (channel: "push" | "email"): ChannelOutcome => {
    logger.info(`Care reminder ${channel} suppressed: recipient opted out`, {
      reminderId: reminder.id,
      organisationId: reminder.organisationId,
    });
    return "suppressed";
  };

  let push: ChannelOutcome = "unreachable";
  if (ownerUserId) {
    if (suppression.push) {
      push = suppressed("push");
    } else {
      // sendToUser reports per-device failures in its results rather than
      // throwing, and returns none when the owner has no registered device.
      // The reminder id keys the in-app row, so a retry keeps the one row.
      push = await NotificationService.sendToUser(
        ownerUserId,
        NotificationTemplates.Care.CARE_REMINDER(patientName, typeLabel),
        { recordId: reminder.id },
      )
        .then((results) => pushOutcome(reminder.id, ownerUserId, results))
        .catch((err: unknown): ChannelOutcome => {
          logger.error("Care reminder push notification failed", {
            reminderId: reminder.id,
            err,
          });
          return "failed";
        });
    }
  }

  let email: ChannelOutcome = "unreachable";
  if (ownerEmail) {
    if (suppression.email || !unsubscribeUrl) {
      email = suppressed("email");
    } else {
      email = await sendEmail({
        to: ownerEmail,
        subject: `Care reminder for ${patientName}`,
        htmlBody: buildReminderEmailBody(body, unsubscribeUrl),
      }).then(
        (): ChannelOutcome => "delivered",
        (err: unknown): ChannelOutcome => {
          logger.error("Care reminder email failed", {
            reminderId: reminder.id,
            err,
          });
          return "failed";
        },
      );
    }
  }

  return { push, email };
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

    // The caller is authenticated against this organisation, but the patient id
    // arrives from the request. Without this the row would be written against
    // another tenant's companion, invisible to every view that scopes by org.
    await assertPatientOrgMembership(patientId, organisationId, () => {
      throw new CareReminderError("Companion not found.", 404);
    });

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

    // Every id, not just the first: a single foreign companion in the batch
    // is enough to reach another tenant's owner through the send path.
    await assertPatientsOrgMembership(patientIds, organisationId, () => {
      throw new CareReminderError("Companion not found.", 404);
    });

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

  list(params: ListCareRemindersParams) {
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
    const scope = ReminderScopeSchema.safeParse({ id, organisationId });
    if (!scope.success) {
      throw new CareReminderError("Invalid reminder scope.", 400);
    }
    id = scope.data.id;
    organisationId = scope.data.organisationId;
    const reminder = await assertReminder(id, organisationId);
    if (reminder.status !== "PENDING") {
      throw new CareReminderError(
        `Cannot send a ${reminder.status} reminder.`,
        409,
      );
    }

    const attemptAt = new Date();
    const claim = await prisma.careReminder.updateMany({
      where: { id, organisationId, status: "PENDING" },
      data: {
        status: "SENDING",
        sendingAt: attemptAt,
        lastAttemptAt: attemptAt,
      },
    });
    if (claim.count !== 1) {
      throw new CareReminderError(
        "This reminder is already being sent or has changed.",
        409,
      );
    }

    let delivery: DeliverySummary;
    try {
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
      delivery = await dispatchNotification(
        reminder,
        patientName,
        ownerUserId,
        ownerEmail,
      );
    } catch (error) {
      const failed: DeliverySummary = { push: "failed", email: "failed" };
      await prisma.careReminder.updateMany({
        where: { id, organisationId, status: "SENDING" },
        data: {
          status: "PENDING",
          sendingAt: null,
          lastDelivery: failed,
        },
      });
      await AuditTrailService.recordSafely({
        organisationId,
        patientId: reminder.patientId,
        eventType: "CARE_REMINDER_DELIVERY_ATTEMPT",
        actorType: sentBy ? "PMS_USER" : "SYSTEM",
        actorId: sentBy ?? null,
        entityType: "COMPANION",
        entityId: id,
        metadata: { reminderType: reminder.reminderType, delivery: failed },
      });
      throw error;
    }

    const delivered =
      delivery.push === "delivered" || delivery.email === "delivered";

    const updated = await prisma.careReminder
      .update({
        where: { id, organisationId, status: "SENDING" },
        data: {
          status: delivered ? "SENT" : "PENDING",
          sentAt: delivered ? new Date() : null,
          sendingAt: null,
          lastDelivery: delivery,
        },
        select: reminderSelect,
      })
      .catch((err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          return null;
        }
        throw err;
      });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: reminder.patientId,
      eventType: "CARE_REMINDER_DELIVERY_ATTEMPT",
      actorType: sentBy ? "PMS_USER" : "SYSTEM",
      actorId: sentBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        reminderType: reminder.reminderType,
        dueDate: reminder.dueDate,
        delivery,
      },
    });

    // Preserve the existing sent event for consumers that use it as a delivered signal.
    if (delivered) {
      await AuditTrailService.recordSafely({
        organisationId,
        patientId: reminder.patientId,
        eventType: "CARE_REMINDER_SENT",
        actorType: sentBy ? "PMS_USER" : "SYSTEM",
        actorId: sentBy ?? null,
        entityType: "COMPANION",
        entityId: id,
        metadata: {
          reminderType: reminder.reminderType,
          dueDate: reminder.dueDate,
          delivery,
        },
      });
    }

    if (!updated) {
      throw new CareReminderError(
        "The reminder was cancelled or changed while it was being sent, so its status was not updated.",
        409,
      );
    }

    return updated;
  },

  async sendScheduledDue() {
    const now = Date.now();
    // A claim this old belongs to a send that never finished (a restart mid-send).
    // It goes back to PENDING without a result so staff can see it and decide;
    // lastAttemptAt stays set, so the scheduler below never resends it on its own.
    await prisma.careReminder.updateMany({
      where: {
        status: "SENDING",
        sendingAt: { lt: new Date(now - STALE_SEND_CLAIM_MS) },
      },
      data: { status: "PENDING", sendingAt: null, lastDelivery: Prisma.DbNull },
    });
    const due = await prisma.careReminder.findMany({
      where: {
        status: "PENDING",
        // A send time further back than the window is left for staff to send by
        // hand, so old rows or a long worker outage never release a burst of
        // stale reminders to owners.
        sendAt: {
          lte: new Date(now),
          gte: new Date(now - SCHEDULED_SEND_WINDOW_MS),
        },
        lastAttemptAt: null,
      },
      select: { id: true, organisationId: true },
      orderBy: { sendAt: "asc" },
      take: 100,
    });
    const sendOne = (reminder: (typeof due)[number]) =>
      this.send(reminder.id, reminder.organisationId).catch(
        (error: unknown) => {
          logger.error("Scheduled care reminder could not be delivered", {
            reminderId: reminder.id,
            error,
          });
        },
      );
    // One at a time, so a full batch never outruns the mail provider's send rate.
    await due.reduce<Promise<unknown>>(
      (previous, reminder) => previous.then(() => sendOne(reminder)),
      Promise.resolve(),
    );
    return due.length;
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
    if (reminder.status === "SENDING") {
      throw new CareReminderError(
        "Cannot cancel a reminder while delivery is in progress.",
        409,
      );
    }
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
