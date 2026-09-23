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

type ReminderType =
  | "VACCINATION_BOOSTER"
  | "ANNUAL_CHECKUP"
  | "PARASITE_TREATMENT"
  | "DENTAL_CLEANING"
  | "FOLLOW_UP"
  | "CUSTOM";

type ReminderStatus =
  "PENDING" | "SENT" | "RESPONDED" | "EXPIRED" | "CANCELLED";

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

/**
 * Everything that can refuse the send, resolved before any channel is delivered.
 *
 * Kept separate from delivery for two reasons: it is the only part that can
 * legally block the send, and doing it first means an operational failure cannot
 * leave one channel delivered and the other not. Both failures throw rather than
 * returning quietly, because `send` marks the reminder SENT on return and only a
 * PENDING reminder can be sent again, so a transient problem would otherwise
 * consume a reminder that was never delivered.
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

    const delivery = await dispatchNotification(
      reminder,
      patientName,
      ownerUserId,
      ownerEmail,
    );
    const outcomes = new Set([delivery.push, delivery.email]);
    // Every channel that was tried failed. Marking it SENT would show the
    // clinic a reminder nobody received, and only a PENDING reminder can be
    // sent again, so it stays PENDING for a retry.
    if (outcomes.has("failed") && !outcomes.has("delivered")) {
      throw new CareReminderError(
        "The reminder could not be delivered. It is still pending, so it can be sent again.",
        502,
      );
    }

    // Only a reminder still PENDING becomes SENT. Delivery takes seconds, and a
    // cancel (or a second send) that lands in between must not be overwritten.
    // P2025 is that case: the row was read moments ago in this request, so no
    // match means its status moved, not that the id is wrong.
    const updated = await prisma.careReminder
      .update({
        where: { id, organisationId, status: "PENDING" },
        data: { status: "SENT", sentAt: new Date() },
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

    // Recorded either way: what reached the owner is true whatever the status.
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
        delivery,
      },
    });

    if (!updated) {
      throw new CareReminderError(
        "The reminder was cancelled or changed while it was being sent, so its status was not updated.",
        409,
      );
    }

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
