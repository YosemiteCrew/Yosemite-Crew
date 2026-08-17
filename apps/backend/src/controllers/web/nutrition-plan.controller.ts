import { z } from "zod";
import {
  NutritionPlanService,
  NutritionPlanError,
} from "src/services/nutrition-plan.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const StatusEnum = z.enum(["ACTIVE", "COMPLETED", "DISCONTINUED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  dietName: z.string().min(1).max(300),
  calories: z.number().positive().optional(),
  calorieUnit: z.string().max(50).optional(),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fibre: z.number().min(0).optional(),
  feedingFrequency: z.string().max(200).optional(),
  portionSize: z.string().max(200).optional(),
  waterIntake: z.string().max(200).optional(),
  restrictions: z.string().max(2000).optional(),
  indication: z.string().max(1000).optional(),
  reviewDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  dietName: z.string().min(1).max(300).optional(),
  calories: z.number().positive().optional(),
  calorieUnit: z.string().max(50).optional(),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fibre: z.number().min(0).optional(),
  feedingFrequency: z.string().max(200).optional(),
  portionSize: z.string().max(200).optional(),
  waterIntake: z.string().max(200).optional(),
  restrictions: z.string().max(2000).optional(),
  indication: z.string().max(1000).optional(),
  reviewDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  status: StatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const { handler } = createClinicalHandlers(NutritionPlanError);

export const NutritionPlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list nutrition plans",
    run: ({ params, input }) =>
      NutritionPlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create nutrition plan",
    run: ({ params, input, userId }) => {
      const { reviewDate, ...rest } = input;
      return NutritionPlanService.create({
        organisationId: params.organisationId,
        prescribedBy: userId,
        ...rest,
        ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
      });
    },
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get nutrition plan",
    run: ({ params }) =>
      NutritionPlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update nutrition plan",
    run: ({ params, input, userId }) => {
      const { reviewDate, ...rest } = input;
      return NutritionPlanService.update(
        params.planId,
        params.organisationId,
        {
          ...rest,
          ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
        },
        userId,
      );
    },
  }),
};
