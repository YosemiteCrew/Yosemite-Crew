import { z } from "zod";
import {
  OphthalmologyExaminationService,
  OphthalmologyExaminationError,
} from "src/services/ophthalmology-examination.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const VisionStatusEnum = z.enum(["NORMAL", "REDUCED", "ABSENT", "UNKNOWN"]);
const PLRResponseEnum = z.enum(["NORMAL", "SLUGGISH", "ABSENT"]);

const EyeFindingSchema = z.object({
  discharge: z
    .enum(["ABSENT", "SEROUS", "MUCOID", "PURULENT", "HAEMORRHAGIC"])
    .optional(),
  cornealClarity: z
    .enum(["CLEAR", "HAZE", "OEDEMA", "ULCER", "OPACITY"])
    .optional(),
  lensClarity: z
    .enum([
      "CLEAR",
      "EARLY_CATARACT",
      "MATURE_CATARACT",
      "HYPERMATURE_CATARACT",
    ])
    .optional(),
  vitreousClarity: z
    .enum(["CLEAR", "HAZE", "HAEMORRHAGE", "FLOATERS"])
    .optional(),
  retina: z
    .enum(["NORMAL", "DETACHED", "DEGENERATIVE", "HAEMORRHAGE", "PAPILLOEDEMA"])
    .optional(),
  conjunctiva: z
    .enum(["NORMAL", "HYPERAEMIC", "CHEMOSIS", "FOLLICLES"])
    .optional(),
  notes: z.string().max(1000).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  examinedAt: z.iso.datetime(),
  visionLeft: VisionStatusEnum.optional(),
  visionRight: VisionStatusEnum.optional(),
  menaceLeft: z.boolean().optional(),
  menaceRight: z.boolean().optional(),
  plrDirectLeft: PLRResponseEnum.optional(),
  plrDirectRight: PLRResponseEnum.optional(),
  plrConsensualLeft: PLRResponseEnum.optional(),
  plrConsensualRight: PLRResponseEnum.optional(),
  sttLeft: z.number().int().min(0).max(50).optional(),
  sttRight: z.number().int().min(0).max(50).optional(),
  iopLeft: z.number().min(0).max(100).optional(),
  iopRight: z.number().min(0).max(100).optional(),
  fluoresceinLeft: z.boolean().optional(),
  fluoresceinRight: z.boolean().optional(),
  findingsLeft: EyeFindingSchema.optional(),
  findingsRight: EyeFindingSchema.optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  examinedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery;
const ExamParamsSchema = orgParams.extend({ examId: uuid() });

const { handler } = createClinicalHandlers(OphthalmologyExaminationError);

export const OphthalmologyExaminationController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list ophthalmology examinations",
    run: ({ params, input }) =>
      OphthalmologyExaminationService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create ophthalmology examination",
    run: ({ params, input, userId }) =>
      OphthalmologyExaminationService.create({
        organisationId: params.organisationId,
        examinedBy: userId,
        ...input,
        examinedAt: new Date(input.examinedAt),
      }),
  }),

  get: handler({
    params: ExamParamsSchema,
    fallback: "Failed to get ophthalmology examination",
    run: ({ params }) =>
      OphthalmologyExaminationService.get(params.examId, params.organisationId),
  }),

  update: handler({
    params: ExamParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update ophthalmology examination",
    run: ({ params, input }) =>
      OphthalmologyExaminationService.update(
        params.examId,
        params.organisationId,
        input,
      ),
  }),

  delete: handler({
    params: ExamParamsSchema,
    status: 204,
    fallback: "Failed to delete ophthalmology examination",
    run: ({ params }) =>
      OphthalmologyExaminationService.delete(
        params.examId,
        params.organisationId,
      ),
  }),
};
