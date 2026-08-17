import { z } from "zod";
import {
  DermatologyAssessmentService,
  DermatologyAssessmentError,
} from "src/services/dermatology-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const LesionMapRegionSchema = z.object({
  region: z.string().min(1).max(100),
  lesions: z.array(z.string().max(200)),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  pruritusScore: z.number().int().min(0).max(10).optional(),
  affectedRegions: z.array(z.string().max(200)).optional(),
  primaryLesions: z.array(z.string().max(200)).optional(),
  secondaryLesions: z.array(z.string().max(200)).optional(),
  coatQuality: z.enum(["GOOD", "FAIR", "POOR", "ALOPECIA"]).optional(),
  lesionMap: z.array(LesionMapRegionSchema).optional(),
  environmentalAllergens: z.array(z.string().max(200)).optional(),
  foodTrialStatus: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "INCONCLUSIVE"])
    .optional(),
  cades04Score: z.number().int().min(0).max(60).optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery;
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(DermatologyAssessmentError);

export const DermatologyAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list dermatology assessments",
    run: ({ params, input }) =>
      DermatologyAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create dermatology assessment",
    run: ({ params, input, userId }) =>
      DermatologyAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get dermatology assessment",
    run: ({ params }) =>
      DermatologyAssessmentService.get(
        params.assessmentId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update dermatology assessment",
    run: ({ params, input }) =>
      DermatologyAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete dermatology assessment",
    run: ({ params }) =>
      DermatologyAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
