import { z } from "zod";
import {
  PreventiveCarePlanService,
  PreventiveCarePlanError,
} from "src/services/preventive-care-plan.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const FrequencyEnum = z.enum([
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
  "CUSTOM",
]);
const StatusEnum = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);

const ItemSchema = z.object({
  careType: z.string().min(1).max(200),
  frequency: FrequencyEnum,
  intervalDays: z.number().int().positive().optional(),
  nextDueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  items: z.array(ItemSchema).optional(),
});

const UpdatePlanBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const CompleteItemBodySchema = z.object({
  completedAt: z.string().datetime().optional(),
  nextDueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });
const ItemParamsSchema = orgParams.extend({ planId: uuid(), itemId: uuid() });

const { handler } = createClinicalHandlers(PreventiveCarePlanError);

export const PreventiveCarePlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list care plans",
    run: ({ params, input }) =>
      PreventiveCarePlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create care plan",
    run: ({ params, input, userId }) => {
      const { items, ...rest } = input;
      return PreventiveCarePlanService.create({
        organisationId: params.organisationId,
        createdBy: userId,
        ...rest,
        items: items?.map((i) => ({
          ...i,
          nextDueAt: i.nextDueAt ? new Date(i.nextDueAt) : undefined,
        })),
      });
    },
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get care plan",
    run: ({ params }) =>
      PreventiveCarePlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: UpdatePlanBodySchema,
    fallback: "Failed to update care plan",
    run: ({ params, input, userId }) =>
      PreventiveCarePlanService.update(
        params.planId,
        params.organisationId,
        input,
        userId,
      ),
  }),

  addItem: handler({
    params: PlanParamsSchema,
    body: ItemSchema,
    status: 201,
    fallback: "Failed to add care plan item",
    run: ({ params, input }) => {
      const { nextDueAt, ...rest } = input;
      return PreventiveCarePlanService.addItem(
        params.planId,
        params.organisationId,
        { ...rest, nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined },
      );
    },
  }),

  completeItem: handler({
    params: ItemParamsSchema,
    body: CompleteItemBodySchema,
    fallback: "Failed to complete care plan item",
    run: ({ params, input, userId }) => {
      const { completedAt, nextDueAt, ...rest } = input;
      return PreventiveCarePlanService.completeItem(
        params.itemId,
        params.organisationId,
        {
          ...rest,
          completedAt: completedAt ? new Date(completedAt) : undefined,
          nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined,
        },
        userId,
      );
    },
  }),
};
