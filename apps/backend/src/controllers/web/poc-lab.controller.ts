import { z } from "zod";
import { PocLabService, PocLabError } from "src/services/poc-lab.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const PocTestTypeEnum = z.enum([
  "CBC",
  "BLOOD_CHEMISTRY",
  "URINALYSIS",
  "FECAL_FLOAT",
  "CYTOLOGY",
  "COAGULATION",
  "ELECTROLYTES",
  "THYROID_PANEL",
  "CORTISOL",
  "GLUCOSE_CURVE",
  "BLOOD_GAS",
  "OTHER",
]);

const LabResultParamSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.union([z.number(), z.string()]),
  unit: z.string().max(50).optional(),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  flag: z.enum(["H", "L", "HH", "LL", "N"]).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  conductedAt: z.string().datetime(),
  testType: PocTestTypeEnum,
  analyzerName: z.string().max(200).optional(),
  sampleType: z.string().max(100).optional(),
  results: z.array(LabResultParamSchema).min(1),
  overallInterpretation: z.string().max(3000).optional(),
  abnormalFlags: z.array(z.string().max(100)).optional(),
  criticalFlags: z.array(z.string().max(100)).optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  overallInterpretation: z.string().max(3000).optional(),
  abnormalFlags: z.array(z.string().max(100)).optional(),
  criticalFlags: z.array(z.string().max(100)).optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().max(3000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  testType: PocTestTypeEnum.optional(),
});
const RecordParamsSchema = orgParams.extend({ recordId: uuid() });

const { handler } = createClinicalHandlers(PocLabError);

export const PocLabController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list POC lab results",
    run: ({ params, input }) =>
      PocLabService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create POC lab result",
    run: ({ params, input, userId }) =>
      PocLabService.create({
        organisationId: params.organisationId,
        conductedBy: userId,
        ...input,
        conductedAt: new Date(input.conductedAt),
      }),
  }),

  get: handler({
    params: RecordParamsSchema,
    fallback: "Failed to get POC lab result",
    run: ({ params }) =>
      PocLabService.get(params.recordId, params.organisationId),
  }),

  update: handler({
    params: RecordParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update POC lab result",
    run: ({ params, input }) =>
      PocLabService.update(params.recordId, params.organisationId, input),
  }),

  delete: handler({
    params: RecordParamsSchema,
    status: 204,
    fallback: "Failed to delete POC lab result",
    run: ({ params }) =>
      PocLabService.delete(params.recordId, params.organisationId),
  }),
};
