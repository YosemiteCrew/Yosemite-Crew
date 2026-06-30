import { Request, Response } from "express";
import { z } from "zod";
import { AppointmentReminderLogService } from "src/services/appointment-reminder-log.service";

const ChannelEnum = z.enum([
  "SMS",
  "EMAIL",
  "PUSH_NOTIFICATION",
  "PHONE_CALL",
  "WHATSAPP",
]);

const OutcomeEnum = z.enum([
  "DELIVERED",
  "OPENED",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED",
  "NO_RESPONSE",
  "BOUNCED",
  "FAILED",
]);

const RecordSchema = z.object({
  appointmentId: z.string(),
  clientId: z.string(),
  channel: ChannelEnum,
  outcome: OutcomeEnum.optional(),
  sentAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  respondedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  messagePreview: z.string().optional(),
  externalId: z.string().optional(),
  errorMessage: z.string().optional(),
});

const UpdateOutcomeSchema = z.object({
  outcome: OutcomeEnum,
  respondedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

const ListByClientQuerySchema = z.object({
  channel: ChannelEnum.optional(),
  outcome: OutcomeEnum.optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

export const AppointmentReminderLogController = {
  record: async (req: Request, res: Response) => {
    const parsed = RecordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const log = await AppointmentReminderLogService.record({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(log);
  },

  updateOutcome: async (req: Request, res: Response) => {
    const parsed = UpdateOutcomeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const log = await AppointmentReminderLogService.updateOutcome(
      req.params.logId,
      req.params.organisationId,
      parsed.data.outcome,
      parsed.data.respondedAt,
    );
    return res.json(log);
  },

  listForAppointment: async (req: Request, res: Response) => {
    const logs = await AppointmentReminderLogService.listForAppointment(
      req.params.appointmentId,
      req.params.organisationId,
    );
    return res.json(logs);
  },

  listForClient: async (req: Request, res: Response) => {
    const parsed = ListByClientQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const logs = await AppointmentReminderLogService.listForClient(
      req.params.clientId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(logs);
  },

  stats: async (req: Request, res: Response) => {
    const stats = await AppointmentReminderLogService.stats(
      req.params.organisationId,
      {
        appointmentId: req.query.appointmentId as string | undefined,
        channel: req.query.channel as Parameters<
          typeof AppointmentReminderLogService.stats
        >[1]["channel"],
      },
    );
    return res.json(stats);
  },
};
