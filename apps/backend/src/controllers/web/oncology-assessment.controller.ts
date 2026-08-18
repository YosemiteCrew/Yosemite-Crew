import { z } from "zod";
import {
  OncologyAssessmentService,
  OncologyAssessmentError,
} from "src/services/oncology-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const OncologyStageEnum = z.enum([
  "STAGE_0",
  "STAGE_I",
  "STAGE_IA",
  "STAGE_IB",
  "STAGE_II",
  "STAGE_IIA",
  "STAGE_IIB",
  "STAGE_III",
  "STAGE_IIIA",
  "STAGE_IIIB",
  "STAGE_IV",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  tumorType: z.string().max(200).optional(),
  primaryTumorStage: z.string().max(10).optional(),
  nodeStage: z.string().max(10).optional(),
  metastasisStage: z.string().max(10).optional(),
  overallStage: OncologyStageEnum.optional(),
  chemotherapyProtocol: z.string().max(200).optional(),
  chemotherapyStartDate: z.string().datetime().optional(),
  chemotherapyCycles: z.number().int().min(1).max(100).optional(),
  qualityOfLifeScore: z.number().int().min(0).max(10).optional(),
  prognosis: z.string().max(3000).optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery.extend({
  overallStage: OncologyStageEnum.optional(),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(OncologyAssessmentError);

export const OncologyAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list oncology assessments",
    run: ({ params, input }) =>
      OncologyAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create oncology assessment",
    run: ({ params, input, userId }) =>
      OncologyAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
        chemotherapyStartDate: input.chemotherapyStartDate
          ? new Date(input.chemotherapyStartDate)
          : undefined,
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get oncology assessment",
    run: ({ params }) =>
      OncologyAssessmentService.get(params.assessmentId, params.organisationId),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update oncology assessment",
    run: ({ params, input }) =>
      OncologyAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        {
          ...input,
          chemotherapyStartDate: input.chemotherapyStartDate
            ? new Date(input.chemotherapyStartDate)
            : undefined,
        },
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete oncology assessment",
    run: ({ params }) =>
      OncologyAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
