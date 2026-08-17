import { z } from "zod";
import {
  DentalExaminationService,
  DentalExaminationError,
} from "src/services/dental-examination.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const DentalGradeEnum = z.enum([
  "GRADE_0",
  "GRADE_1",
  "GRADE_2",
  "GRADE_3",
  "GRADE_4",
]);

const ToothFindingSchema = z.object({
  tooth: z.string().min(1).max(10),
  condition: z
    .enum([
      "NORMAL",
      "FRACTURE",
      "MISSING",
      "EXTRACTED",
      "SUPERNUMERARY",
      "PERSISTENT_DECIDUOUS",
      "GINGIVITIS",
      "PERIODONTITIS",
      "TOOTH_RESORPTION",
      "NEOPLASIA",
      "OTHER",
    ])
    .optional(),
  mobilityGrade: z
    .enum(["GRADE_0", "GRADE_1", "GRADE_2", "GRADE_3"])
    .optional(),
  calculus: z.number().int().min(0).max(3).optional(),
  periodontalDepth: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  examinedAt: z.string().datetime(),
  overallGrade: DentalGradeEnum,
  findings: z.array(ToothFindingSchema),
  calculusScore: z.number().int().min(0).max(3).optional(),
  plaqueScore: z.number().int().min(0).max(3).optional(),
  gingivalScore: z.number().int().min(0).max(3).optional(),
  procedures: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  overallGrade: DentalGradeEnum.optional(),
  findings: z.array(ToothFindingSchema).optional(),
  calculusScore: z.number().int().min(0).max(3).optional(),
  plaqueScore: z.number().int().min(0).max(3).optional(),
  gingivalScore: z.number().int().min(0).max(3).optional(),
  procedures: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const ListQuerySchema = patientScopeQuery;

const ExamParamsSchema = orgParams.extend({ examId: uuid() });

const { handler } = createClinicalHandlers(DentalExaminationError);

export const DentalExaminationController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list dental examinations",
    run: ({ params, input }) =>
      DentalExaminationService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create dental examination",
    run: ({ params, input, userId }) =>
      DentalExaminationService.create({
        organisationId: params.organisationId,
        examinedBy: userId,
        ...input,
        examinedAt: new Date(input.examinedAt),
      }),
  }),

  get: handler({
    params: ExamParamsSchema,
    fallback: "Failed to get dental examination",
    run: ({ params }) =>
      DentalExaminationService.get(params.examId, params.organisationId),
  }),

  update: handler({
    params: ExamParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update dental examination",
    run: ({ params, input }) =>
      DentalExaminationService.update(
        params.examId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: ExamParamsSchema,
    status: 204,
    fallback: "Failed to delete dental examination",
    run: ({ params }) =>
      DentalExaminationService.delete(params.examId, params.organisationId),
  }),
};
