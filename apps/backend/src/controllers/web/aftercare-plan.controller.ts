import { z } from "zod";
import {
  AftercarePlanService,
  AftercarePlanError,
} from "src/services/aftercare-plan.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";
import { parseOptionalBooleanFlag } from "src/utils/query-flags";

const AftercareTypeEnum = z.enum([
  "EUTHANASIA_SERVICE",
  "CREMATION_PRIVATE",
  "CREMATION_COMMUNAL",
  "AQUAMATION",
  "BURIAL",
  "HOME_CARE",
  "DONATION_TO_SCIENCE",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  type: AftercareTypeEnum,
  provider: z.string().max(200).optional(),
  estimatedCost: z.number().min(0).optional(),
  depositPaid: z.number().min(0).optional(),
  pawPrintRequested: z.boolean().optional(),
  furClippingRequested: z.boolean().optional(),
  urnsRequested: z.number().int().min(0).optional(),
  instructions: z.string().max(3000).optional(),
  certificateNumber: z.string().max(100).optional(),
  completedAt: z.iso.datetime().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  type: true,
}).partial();

const ListQuerySchema = z.object({
  patientId: z.uuid().optional(),
  type: AftercareTypeEnum.optional(),
  completed: z.string().optional().transform(parseOptionalBooleanFlag),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const { handler } = createClinicalHandlers(AftercarePlanError);

export const AftercarePlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list aftercare plans",
    run: ({ params, input }) =>
      AftercarePlanService.list({
        organisationId: params.organisationId,
        patientId: input.patientId,
        type: input.type,
        completed: input.completed,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create aftercare plan",
    run: ({ params, input, userId }) =>
      AftercarePlanService.create({
        organisationId: params.organisationId,
        recordedBy: userId,
        ...input,
        completedAt: input.completedAt
          ? new Date(input.completedAt)
          : undefined,
      }),
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get aftercare plan",
    run: ({ params }) =>
      AftercarePlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update aftercare plan",
    run: ({ params, input }) =>
      AftercarePlanService.update(params.planId, params.organisationId, {
        ...input,
        completedAt: input.completedAt
          ? new Date(input.completedAt)
          : undefined,
      }),
  }),

  delete: handler({
    params: PlanParamsSchema,
    status: 204,
    fallback: "Failed to delete aftercare plan",
    run: ({ params }) =>
      AftercarePlanService.delete(params.planId, params.organisationId),
  }),
};
