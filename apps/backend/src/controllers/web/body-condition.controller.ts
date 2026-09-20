import { z } from "zod";
import {
  BodyConditionService,
  BodyConditionError,
} from "src/services/body-condition.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const BcsScaleEnum = z.enum(["BCS_5", "BCS_9"]);

const RecordBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  bcsScale: BcsScaleEnum,
  bcsScore: z.number().min(1).max(9),
  muscleConditionScore: z.string().max(200).optional(),
  weightKg: z.number().min(0).max(1000).optional(),
  bodyFatPercentage: z.number().min(0).max(100).optional(),
  recordedAt: z.iso.datetime(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  bcsScale: BcsScaleEnum.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const TrendQuerySchema = z.object({
  patientId: z.uuid(),
  limit: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .optional(),
});

const RecordParamsSchema = orgParams.extend({ recordId: uuid() });

const { handler } = createClinicalHandlers(BodyConditionError);

export const BodyConditionController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list body condition records",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return BodyConditionService.list({
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
    fallback: "Failed to record body condition",
    run: ({ params, input, userId }) => {
      const { recordedAt, ...rest } = input;
      return BodyConditionService.record({
        organisationId: params.organisationId,
        recordedBy: userId,
        ...rest,
        recordedAt: new Date(recordedAt),
      });
    },
  }),

  get: handler({
    params: RecordParamsSchema,
    fallback: "Failed to get body condition record",
    run: ({ params }) =>
      BodyConditionService.get(params.recordId, params.organisationId),
  }),

  trend: handler({
    params: orgParams,
    query: TrendQuerySchema,
    fallback: "Failed to get body condition trend",
    run: ({ params, input }) =>
      BodyConditionService.trend(
        input.patientId,
        params.organisationId,
        input.limit,
      ),
  }),

  delete: handler({
    params: RecordParamsSchema,
    status: 204,
    fallback: "Failed to delete body condition record",
    run: ({ params }) =>
      BodyConditionService.delete(params.recordId, params.organisationId),
  }),
};
