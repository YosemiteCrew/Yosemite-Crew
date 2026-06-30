import type { Request, Response } from "express";
import { z } from "zod";
import {
  CareReminderService,
  CareReminderError,
} from "src/services/care-reminder.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ReminderTypeEnum = z.enum([
  "VACCINATION_BOOSTER",
  "ANNUAL_CHECKUP",
  "PARASITE_TREATMENT",
  "DENTAL_CLEANING",
  "FOLLOW_UP",
  "CUSTOM",
]);

const ReminderStatusEnum = z.enum([
  "PENDING",
  "SENT",
  "RESPONDED",
  "EXPIRED",
  "CANCELLED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  reminderType: ReminderTypeEnum,
  customMessage: z.string().max(1000).optional(),
  dueDate: z.string().datetime(),
  sendAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const BulkCreateBodySchema = z.object({
  patientIds: z.array(z.string().uuid()).min(1).max(200),
  reminderType: ReminderTypeEnum,
  customMessage: z.string().max(1000).optional(),
  dueDate: z.string().datetime(),
  sendAt: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: ReminderStatusEnum.optional(),
  reminderType: ReminderTypeEnum.optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
});

const MarkRespondedBodySchema = z.object({
  appointmentId: z.string().uuid().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ReminderParamsSchema = z.object({
  organisationId: z.string().uuid(),
  reminderId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof CareReminderError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const CareReminderController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { dueBefore, dueAfter, ...rest } = query.data;
      const reminders = await CareReminderService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(dueBefore ? { dueBefore: new Date(dueBefore) } : {}),
        ...(dueAfter ? { dueAfter: new Date(dueAfter) } : {}),
      });
      return res.status(200).json(reminders);
    } catch (err) {
      return handleError(err, res, "Failed to list care reminders");
    }
  },

  create: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { dueDate, sendAt, ...rest } = body.data;
      const reminder = await CareReminderService.create({
        organisationId: params.data.organisationId,
        createdBy: typedReq.userId ?? undefined,
        dueDate: new Date(dueDate),
        ...(sendAt ? { sendAt: new Date(sendAt) } : {}),
        ...rest,
      });
      return res.status(201).json(reminder);
    } catch (err) {
      return handleError(err, res, "Failed to create care reminder");
    }
  },

  bulkCreate: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = BulkCreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { dueDate, sendAt, ...rest } = body.data;
      const result = await CareReminderService.bulkCreate({
        organisationId: params.data.organisationId,
        createdBy: typedReq.userId ?? undefined,
        dueDate: new Date(dueDate),
        ...(sendAt ? { sendAt: new Date(sendAt) } : {}),
        ...rest,
      });
      return res.status(201).json(result);
    } catch (err) {
      return handleError(err, res, "Failed to bulk create care reminders");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ReminderParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const reminder = await CareReminderService.get(
        params.data.reminderId,
        params.data.organisationId,
      );
      return res.status(200).json(reminder);
    } catch (err) {
      return handleError(err, res, "Failed to get care reminder");
    }
  },

  send: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ReminderParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const reminder = await CareReminderService.send(
        params.data.reminderId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(reminder);
    } catch (err) {
      return handleError(err, res, "Failed to send care reminder");
    }
  },

  markResponded: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ReminderParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = MarkRespondedBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const reminder = await CareReminderService.markResponded(
        params.data.reminderId,
        params.data.organisationId,
        body.data.appointmentId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(reminder);
    } catch (err) {
      return handleError(err, res, "Failed to mark reminder as responded");
    }
  },

  cancel: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ReminderParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const reminder = await CareReminderService.cancel(
        params.data.reminderId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(reminder);
    } catch (err) {
      return handleError(err, res, "Failed to cancel care reminder");
    }
  },
};
