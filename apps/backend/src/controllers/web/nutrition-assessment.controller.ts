import { z } from "zod";
import {
  NutritionAssessmentService,
  NutritionAssessmentError,
} from "src/services/nutrition-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const AppetiteScoreEnum = z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "NONE"]);
const FeedingRouteEnum = z.enum([
  "ORAL",
  "NASOGASTRIC",
  "ESOPHAGOSTOMY",
  "GASTROSTOMY",
  "IV_PARENTERAL",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  appetiteScore: AppetiteScoreEnum.optional(),
  bodyConditionScore: z.number().int().min(1).max(9).optional(),
  muscleConditionScore: z.number().int().min(1).max(4).optional(),
  currentWeightKg: z.number().positive().optional(),
  idealWeightKg: z.number().positive().optional(),
  restingEnergyRequirement: z.number().positive().optional(),
  feedingRoute: FeedingRouteEnum.optional(),
  currentDiet: z.string().max(500).optional(),
  feedingPlan: z.string().max(3000).optional(),
  supplementation: z.array(z.string().max(200)).optional(),
  hydrationStatus: z
    .enum([
      "ADEQUATE",
      "MILD_DEHYDRATION",
      "MODERATE_DEHYDRATION",
      "SEVERE_DEHYDRATION",
    ])
    .optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery.extend({
  appetiteScore: AppetiteScoreEnum.optional(),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(NutritionAssessmentError);

export const NutritionAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list nutrition assessments",
    run: ({ params, input }) =>
      NutritionAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create nutrition assessment",
    run: ({ params, input, userId }) =>
      NutritionAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get nutrition assessment",
    run: ({ params }) =>
      NutritionAssessmentService.get(
        params.assessmentId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update nutrition assessment",
    run: ({ params, input }) =>
      NutritionAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete nutrition assessment",
    run: ({ params }) =>
      NutritionAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
