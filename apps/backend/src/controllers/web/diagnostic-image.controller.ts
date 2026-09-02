import { z } from "zod";
import {
  DiagnosticImageService,
  DiagnosticImageError,
} from "src/services/diagnostic-image.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ImagingTypeEnum = z.enum([
  "RADIOGRAPH",
  "ULTRASOUND",
  "CT_SCAN",
  "MRI",
  "ENDOSCOPY",
  "FLUOROSCOPY",
  "SCINTIGRAPHY",
  "OTHER",
]);
const ImagingStatusEnum = z.enum([
  "PENDING_REVIEW",
  "REVIEWED",
  "REQUIRES_SPECIALIST",
]);

const RecordBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  imagingType: ImagingTypeEnum,
  bodyRegion: z.string().max(200).optional(),
  indication: z.string().max(1000).optional(),
  takenAt: z.iso.datetime(),
  takenBy: z.string().max(200).optional(),
  interpretedBy: z.string().max(200).optional(),
  interpretedAt: z.iso.datetime().optional(),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  documentId: z.uuid().optional(),
});

const ReviewBodySchema = z.object({
  interpretedBy: z.string().max(200),
  findings: z.string().max(5000),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  status: ImagingStatusEnum.optional(),
});

const UpdateBodySchema = z.object({
  bodyRegion: z.string().max(200).optional(),
  indication: z.string().max(1000).optional(),
  takenBy: z.string().max(200).optional(),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  documentId: z.uuid().optional(),
  status: ImagingStatusEnum.optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  imagingType: ImagingTypeEnum.optional(),
  status: ImagingStatusEnum.optional(),
});

const ImageParamsSchema = orgParams.extend({ imageId: uuid() });

const { handler } = createClinicalHandlers(DiagnosticImageError);

export const DiagnosticImageController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list diagnostic images",
    run: ({ params, input }) =>
      DiagnosticImageService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  record: handler({
    params: orgParams,
    body: RecordBodySchema,
    status: 201,
    fallback: "Failed to record diagnostic image",
    run: ({ params, input, userId }) => {
      const { takenAt, interpretedAt, ...rest } = input;
      return DiagnosticImageService.record({
        organisationId: params.organisationId,
        takenBy: userId,
        ...rest,
        takenAt: new Date(takenAt),
        ...(interpretedAt ? { interpretedAt: new Date(interpretedAt) } : {}),
      });
    },
  }),

  get: handler({
    params: ImageParamsSchema,
    fallback: "Failed to get diagnostic image",
    run: ({ params }) =>
      DiagnosticImageService.get(params.imageId, params.organisationId),
  }),

  review: handler({
    params: ImageParamsSchema,
    body: ReviewBodySchema,
    fallback: "Failed to review diagnostic image",
    run: ({ params, input, userId }) =>
      DiagnosticImageService.review(
        params.imageId,
        params.organisationId,
        input,
        userId,
      ),
  }),

  update: handler({
    params: ImageParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update diagnostic image",
    run: ({ params, input }) =>
      DiagnosticImageService.update(
        params.imageId,
        params.organisationId,
        input,
      ),
  }),
};
