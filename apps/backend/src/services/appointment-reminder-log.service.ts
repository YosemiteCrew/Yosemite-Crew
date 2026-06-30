import { prisma } from "src/config/prisma";
import type { Prisma } from "@prisma/client";

export class AppointmentReminderLogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppointmentReminderLogError";
  }
}

type ReminderChannel =
  | "SMS"
  | "EMAIL"
  | "PUSH_NOTIFICATION"
  | "PHONE_CALL"
  | "WHATSAPP";
type ReminderOutcome =
  | "DELIVERED"
  | "OPENED"
  | "CONFIRMED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "NO_RESPONSE"
  | "BOUNCED"
  | "FAILED";

export interface CreateReminderLogParams {
  organisationId: string;
  appointmentId: string;
  clientId: string;
  channel: ReminderChannel;
  outcome?: ReminderOutcome;
  sentAt: Date;
  respondedAt?: Date;
  messagePreview?: string;
  externalId?: string;
  errorMessage?: string;
}

const reminderLogSelect = {
  id: true,
  organisationId: true,
  appointmentId: true,
  clientId: true,
  channel: true,
  outcome: true,
  sentAt: true,
  respondedAt: true,
  messagePreview: true,
  externalId: true,
  errorMessage: true,
  createdAt: true,
} satisfies Prisma.AppointmentReminderLogSelect;

const assertLog = async (id: string, organisationId: string) => {
  const log = await prisma.appointmentReminderLog.findFirst({
    where: { id, organisationId },
    select: reminderLogSelect,
  });
  if (!log) {
    throw new AppointmentReminderLogError("Reminder log entry not found.", 404);
  }
  return log;
};

export const AppointmentReminderLogService = {
  async record(params: CreateReminderLogParams) {
    const { organisationId, ...rest } = params;
    return prisma.appointmentReminderLog.create({
      data: {
        organisationId,
        appointmentId: rest.appointmentId,
        clientId: rest.clientId,
        channel: rest.channel,
        outcome: rest.outcome ?? "DELIVERED",
        sentAt: rest.sentAt,
        respondedAt: rest.respondedAt ?? null,
        messagePreview: rest.messagePreview ?? null,
        externalId: rest.externalId ?? null,
        errorMessage: rest.errorMessage ?? null,
      },
      select: reminderLogSelect,
    });
  },

  async updateOutcome(
    id: string,
    organisationId: string,
    outcome: ReminderOutcome,
    respondedAt?: Date,
  ) {
    await assertLog(id, organisationId);
    return prisma.appointmentReminderLog.update({
      where: { id },
      data: {
        outcome,
        respondedAt: respondedAt ?? null,
      },
      select: reminderLogSelect,
    });
  },

  async listForAppointment(appointmentId: string, organisationId: string) {
    return prisma.appointmentReminderLog.findMany({
      where: { appointmentId, organisationId },
      select: reminderLogSelect,
      orderBy: { sentAt: "desc" },
    });
  },

  async listForClient(
    clientId: string,
    organisationId: string,
    params?: {
      channel?: ReminderChannel;
      outcome?: ReminderOutcome;
      limit?: number;
    },
  ) {
    return prisma.appointmentReminderLog.findMany({
      where: {
        clientId,
        organisationId,
        ...(params?.channel ? { channel: params.channel } : {}),
        ...(params?.outcome ? { outcome: params.outcome } : {}),
      },
      select: reminderLogSelect,
      orderBy: { sentAt: "desc" },
      take: params?.limit ?? 100,
    });
  },

  async stats(
    organisationId: string,
    params: { appointmentId?: string; channel?: ReminderChannel },
  ) {
    const logs = await prisma.appointmentReminderLog.findMany({
      where: {
        organisationId,
        ...(params.appointmentId
          ? { appointmentId: params.appointmentId }
          : {}),
        ...(params.channel ? { channel: params.channel } : {}),
      },
      select: { outcome: true },
    });

    const totals: Record<string, number> = {};
    for (const log of logs) {
      totals[log.outcome] = (totals[log.outcome] ?? 0) + 1;
    }
    return { total: logs.length, byOutcome: totals };
  },
};
