import { z } from "zod";
import {
  BehaviorAssessmentService,
  BehaviorAssessmentError,
} from "src/services/behavior-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const FasScoreEnum = z.enum([
  "FAS_0",
  "FAS_1",
  "FAS_2",
  "FAS_3",
  "FAS_4",
  "FAS_5",
]);
const HandlingToleranceEnum = z.enum([
  "EASY",
  "MODERATE",
  "DIFFICULT",
  "EXTREME",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  fasScore: FasScoreEnum.optional(),
  nailTrimTolerance: HandlingToleranceEnum.optional(),
  handlingTolerance: HandlingToleranceEnum.optional(),
  aggressionTriggers: z.array(z.string().max(200)).optional(),
  aversionBehaviors: z.array(z.string().max(200)).optional(),
  trainingHistory: z.string().max(300).optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  referralRecommended: z.boolean().optional(),
  fearFreeNotes: z.string().max(3000).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery.extend({
  fasScore: FasScoreEnum.optional(),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(BehaviorAssessmentError);

export const BehaviorAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list behavior assessments",
    run: ({ params, input }) =>
      BehaviorAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create behavior assessment",
    run: ({ params, input, userId }) =>
      BehaviorAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get behavior assessment",
    run: ({ params }) =>
      BehaviorAssessmentService.get(params.assessmentId, params.organisationId),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update behavior assessment",
    run: ({ params, input }) =>
      BehaviorAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete behavior assessment",
    run: ({ params }) =>
      BehaviorAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
