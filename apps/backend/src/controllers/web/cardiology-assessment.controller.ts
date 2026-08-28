import { z } from "zod";
import {
  CardiologyAssessmentService,
  CardiologyAssessmentError,
} from "src/services/cardiology-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const HeartRhythmEnum = z.enum([
  "NORMAL_SINUS",
  "SINUS_ARRHYTHMIA",
  "BRADYCARDIA",
  "TACHYCARDIA",
  "ATRIAL_FIBRILLATION",
  "SECOND_DEGREE_AV_BLOCK",
  "THIRD_DEGREE_AV_BLOCK",
  "VENTRICULAR_PREMATURE_CONTRACTIONS",
  "SUPRAVENTRICULAR_PREMATURE_CONTRACTIONS",
  "OTHER",
]);
const MurmurGradeEnum = z.enum([
  "GRADE_1",
  "GRADE_2",
  "GRADE_3",
  "GRADE_4",
  "GRADE_5",
  "GRADE_6",
]);
const AcvimClassEnum = z.enum(["A", "B1", "B2", "C", "D"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  heartRate: z.number().int().min(1).max(500).optional(),
  heartRhythm: HeartRhythmEnum.optional(),
  murmurGrade: MurmurGradeEnum.optional(),
  murmurLocation: z.string().max(300).optional(),
  murmurCharacter: z.string().max(300).optional(),
  pulseQuality: z.string().max(300).optional(),
  jugularPulse: z.string().max(300).optional(),
  vertebralHeartScore: z.number().min(0).max(30).optional(),
  laAoRatio: z.number().min(0).max(10).optional(),
  fractionalShortening: z.number().min(0).max(100).optional(),
  ejectionFraction: z.number().min(0).max(100).optional(),
  acvimClass: AcvimClassEnum.optional(),
  findings: z.record(z.string(), z.unknown()).optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery.extend({
  acvimClass: AcvimClassEnum.optional(),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handler } = createClinicalHandlers(CardiologyAssessmentError);

export const CardiologyAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list cardiology assessments",
    run: ({ params, input }) =>
      CardiologyAssessmentService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create cardiology assessment",
    run: ({ params, input, userId }) =>
      CardiologyAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get cardiology assessment",
    run: ({ params }) =>
      CardiologyAssessmentService.get(
        params.assessmentId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update cardiology assessment",
    run: ({ params, input }) =>
      CardiologyAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete cardiology assessment",
    run: ({ params }) =>
      CardiologyAssessmentService.delete(
        params.assessmentId,
        params.organisationId,
      ),
  }),
};
