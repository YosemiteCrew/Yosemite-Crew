import { z } from "zod";
import {
  WoundAssessmentService,
  WoundAssessmentError,
} from "src/services/wound-assessment.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const WoundTypeEnum = z.enum([
  "SURGICAL_INCISION",
  "LACERATION",
  "PUNCTURE",
  "ABRASION",
  "BURN",
  "PRESSURE_SORE",
  "ULCER",
  "BITE_WOUND",
  "OTHER",
]);
const HealingStageEnum = z.enum([
  "HAEMOSTASIS",
  "INFLAMMATION",
  "PROLIFERATION",
  "MATURATION",
]);
const HealingStatusEnum = z.enum([
  "HEALING",
  "STATIC",
  "DETERIORATING",
  "HEALED",
  "COMPLICATED",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  woundType: WoundTypeEnum,
  location: z.string().min(1).max(500),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  depthCm: z.number().min(0).optional(),
  healingStage: HealingStageEnum.optional(),
  healingStatus: HealingStatusEnum.optional(),
  exudateType: z.string().max(200).optional(),
  exudateAmount: z.string().max(200).optional(),
  odour: z.string().max(200).optional(),
  woundBed: z.string().max(500).optional(),
  woundEdges: z.string().max(500).optional(),
  periwoundSkin: z.string().max(500).optional(),
  dressing: z.string().max(500).optional(),
  dressingChangeFreq: z.string().max(200).optional(),
  assessedAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  surgicalProcedureId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(WoundAssessmentError);

export const WoundAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list wound assessments",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return WoundAssessmentService.list({
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
    fallback: "Failed to record wound assessment",
    run: ({ params, input, userId }) => {
      const { assessedAt, ...rest } = input;
      return WoundAssessmentService.record({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...rest,
        assessedAt: new Date(assessedAt),
      });
    },
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get wound assessment",
    run: ({ params }) =>
      WoundAssessmentService.get(params.assessmentId, params.organisationId),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete wound assessment",
    run: ({ params }) =>
      WoundAssessmentService.delete(params.assessmentId, params.organisationId),
  }),
};
