import { z } from "zod";
import {
  PathologySubmissionService,
  PathologySubmissionError,
} from "src/services/pathology-submission.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const PathologyTypeEnum = z.enum([
  "HISTOPATHOLOGY",
  "CYTOLOGY",
  "CULTURE_SENSITIVITY",
  "HAEMATOLOGY",
  "BIOCHEMISTRY",
  "URINALYSIS",
  "PCR",
  "SEROLOGY",
  "NECROPSY",
  "OTHER",
]);
const PathologyStatusEnum = z.enum([
  "PENDING",
  "RECEIVED_BY_LAB",
  "PROCESSING",
  "RESULTS_AVAILABLE",
  "REVIEWED",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  pathologyType: PathologyTypeEnum,
  sampleType: z.string().min(1).max(300),
  anatomicSite: z.string().min(1).max(500),
  collectedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().optional(),
  labName: z.string().max(300).optional(),
  labRefNumber: z.string().max(200).optional(),
  clinicalHistory: z.string().max(3000).optional(),
  differentials: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

const RecordResultsBodySchema = z.object({
  results: z.string().min(1).max(10000),
  diagnosis: z.string().max(2000).optional(),
  interpretation: z.string().max(3000).optional(),
  status: PathologyStatusEnum.optional(),
});

const ReviewBodySchema = z.object({
  reviewNotes: z.string().max(3000).optional(),
  diagnosis: z.string().max(2000).optional(),
  interpretation: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  submittedAt: z.iso.datetime().optional(),
  labName: z.string().max(300).optional(),
  labRefNumber: z.string().max(200).optional(),
  clinicalHistory: z.string().max(3000).optional(),
  differentials: z.string().max(2000).optional(),
  status: PathologyStatusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  status: PathologyStatusEnum.optional(),
  pathologyType: PathologyTypeEnum.optional(),
});

const SubmissionParamsSchema = orgParams.extend({ submissionId: uuid() });

const { handler } = createClinicalHandlers(PathologySubmissionError);

export const PathologySubmissionController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list pathology submissions",
    run: ({ params, input }) =>
      PathologySubmissionService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create pathology submission",
    run: ({ params, input, userId }) => {
      const { collectedAt, submittedAt, ...rest } = input;
      return PathologySubmissionService.create({
        organisationId: params.organisationId,
        collectedBy: userId,
        ...rest,
        collectedAt: new Date(collectedAt),
        ...(submittedAt ? { submittedAt: new Date(submittedAt) } : {}),
      });
    },
  }),

  get: handler({
    params: SubmissionParamsSchema,
    fallback: "Failed to get pathology submission",
    run: ({ params }) =>
      PathologySubmissionService.get(
        params.submissionId,
        params.organisationId,
      ),
  }),

  recordResults: handler({
    params: SubmissionParamsSchema,
    body: RecordResultsBodySchema,
    fallback: "Failed to record pathology results",
    run: ({ params, input, userId }) =>
      PathologySubmissionService.recordResults(
        params.submissionId,
        params.organisationId,
        input,
        userId,
      ),
  }),

  review: handler({
    params: SubmissionParamsSchema,
    body: ReviewBodySchema,
    fallback: "Failed to review pathology submission",
    run: ({ params, input, userId }) =>
      PathologySubmissionService.review(
        params.submissionId,
        params.organisationId,
        input,
        userId ?? "unknown",
      ),
  }),

  update: handler({
    params: SubmissionParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update pathology submission",
    run: ({ params, input }) => {
      const { submittedAt, ...rest } = input;
      return PathologySubmissionService.update(
        params.submissionId,
        params.organisationId,
        {
          ...rest,
          ...(submittedAt ? { submittedAt: new Date(submittedAt) } : {}),
        },
      );
    },
  }),
};
