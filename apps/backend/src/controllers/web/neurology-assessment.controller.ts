import { z } from "zod";
import {
  NeurologyAssessmentService,
  NeurologyAssessmentError,
} from "src/services/neurology-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ConsciousnessLevelEnum = z.enum(["ALERT", "OBTUNDED", "STUPOR", "COMA"]);
const GaitScoreEnum = z.enum([
  "NORMAL",
  "PARETIC",
  "ATAXIC",
  "NON_AMBULATORY_PARAPLEGIC",
  "NON_AMBULATORY_TETRAPLEGIC",
]);
const SpinalReflexGradeEnum = z.enum([
  "ABSENT",
  "REDUCED",
  "NORMAL",
  "EXAGGERATED",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  assessedAt: z.iso.datetime(),
  consciousnessLevel: ConsciousnessLevelEnum.optional(),
  gaitScore: GaitScoreEnum.optional(),
  cranialNerveFindings: z.string().max(3000).optional(),
  spinalReflexGrades: z.record(z.string(), SpinalReflexGradeEnum).optional(),
  deepPainPresent: z.boolean().optional(),
  proprioceptionIntact: z.boolean().optional(),
  seizureHistory: z.boolean().optional(),
  seizureFrequency: z.string().max(300).optional(),
  mriRecommended: z.boolean().optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery.extend({
  gaitScore: GaitScoreEnum.optional(),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(NeurologyAssessmentError);

export const NeurologyAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list neurology assessments",
    run: ({ params, input }) =>
      NeurologyAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create neurology assessment",
    run: ({ params, input, userId }) =>
      NeurologyAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get neurology assessment",
    run: ({ params }) =>
      NeurologyAssessmentService.get(
        params.assessmentId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update neurology assessment",
    run: ({ params, input }) =>
      NeurologyAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete neurology assessment",
    run: ({ params }) =>
      NeurologyAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
