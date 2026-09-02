import { z } from "zod";
import {
  PainAssessmentService,
  PainAssessmentError,
} from "src/services/pain-assessment.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const PainScaleEnum = z.enum([
  "NUMERIC_0_10",
  "COLORADO_ACUTE_PAIN_SCALE",
  "GLASGOW_COMPOSITE_PAIN_SCALE",
  "UNESP_BOTUCATU",
  "FELINE_GRIMACE_SCALE",
]);
const PainInterventionEnum = z.enum([
  "ANALGESIC_GIVEN",
  "REPOSITIONED",
  "ICE_APPLIED",
  "BANDAGE_ADJUSTED",
  "ENVIRONMENT_MODIFIED",
  "REASSESSED",
  "OTHER",
]);

const RecordBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  painScale: PainScaleEnum,
  painScore: z.number().int().min(0).max(10),
  rawScore: z.string().max(50).optional(),
  behaviouralSigns: z.string().max(1000).optional(),
  vocalisation: z.boolean().optional(),
  posture: z.string().max(500).optional(),
  assessedAt: z.iso.datetime(),
  interventionType: PainInterventionEnum.optional(),
  interventionDetail: z.string().max(1000).optional(),
  reassessAt: z.iso.datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(PainAssessmentError);

export const PainAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list pain assessments",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return PainAssessmentService.list({
        organisationId: params.organisationId,
        ...rest,
        ...dateRange(from, to),
      });
    },
  }),

  record: handler({
    params: orgParams,
    body: RecordBodySchema,
    status: 201,
    fallback: "Failed to record pain assessment",
    run: ({ params, input, userId }) => {
      const { assessedAt, reassessAt, ...rest } = input;
      return PainAssessmentService.record({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...rest,
        assessedAt: new Date(assessedAt),
        ...(reassessAt ? { reassessAt: new Date(reassessAt) } : {}),
      });
    },
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get pain assessment",
    run: ({ params }) =>
      PainAssessmentService.get(params.assessmentId, params.organisationId),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete pain assessment",
    run: ({ params }) =>
      PainAssessmentService.delete(params.assessmentId, params.organisationId),
  }),
};
