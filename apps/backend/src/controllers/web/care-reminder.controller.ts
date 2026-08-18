import { z } from "zod";
import {
  CareReminderService,
  CareReminderError,
} from "src/services/care-reminder.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

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

const ReminderParamsSchema = orgParams.extend({ reminderId: uuid() });

const { handler } = createClinicalHandlers(CareReminderError);

export const CareReminderController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list care reminders",
    run: ({ params, input }) => {
      const { dueBefore, dueAfter, ...rest } = input;
      return CareReminderService.list({
        organisationId: params.organisationId,
        ...rest,
        ...(dueBefore ? { dueBefore: new Date(dueBefore) } : {}),
        ...(dueAfter ? { dueAfter: new Date(dueAfter) } : {}),
      });
    },
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create care reminder",
    run: ({ params, input, userId }) => {
      const { dueDate, sendAt, ...rest } = input;
      return CareReminderService.create({
        organisationId: params.organisationId,
        createdBy: userId,
        dueDate: new Date(dueDate),
        ...(sendAt ? { sendAt: new Date(sendAt) } : {}),
        ...rest,
      });
    },
  }),

  bulkCreate: handler({
    params: orgParams,
    body: BulkCreateBodySchema,
    status: 201,
    fallback: "Failed to bulk create care reminders",
    run: ({ params, input, userId }) => {
      const { dueDate, sendAt, ...rest } = input;
      return CareReminderService.bulkCreate({
        organisationId: params.organisationId,
        createdBy: userId,
        dueDate: new Date(dueDate),
        ...(sendAt ? { sendAt: new Date(sendAt) } : {}),
        ...rest,
      });
    },
  }),

  get: handler({
    params: ReminderParamsSchema,
    fallback: "Failed to get care reminder",
    run: ({ params }) =>
      CareReminderService.get(params.reminderId, params.organisationId),
  }),

  send: handler({
    params: ReminderParamsSchema,
    fallback: "Failed to send care reminder",
    run: ({ params, userId }) =>
      CareReminderService.send(
        params.reminderId,
        params.organisationId,
        userId,
      ),
  }),

  markResponded: handler({
    params: ReminderParamsSchema,
    body: MarkRespondedBodySchema,
    fallback: "Failed to mark reminder as responded",
    run: ({ params, input, userId }) =>
      CareReminderService.markResponded(
        params.reminderId,
        params.organisationId,
        input.appointmentId,
        userId,
      ),
  }),

  cancel: handler({
    params: ReminderParamsSchema,
    fallback: "Failed to cancel care reminder",
    run: ({ params, userId }) =>
      CareReminderService.cancel(
        params.reminderId,
        params.organisationId,
        userId,
      ),
  }),
};
