import { z } from "zod";
import {
  GeneticHealthScreenService,
  GeneticHealthScreenError,
} from "src/services/genetic-health-screen.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const GeneticResultEnum = z.enum([
  "CLEAR",
  "CARRIER",
  "AFFECTED",
  "AFFECTED_MINOR",
  "INCONCLUSIVE",
  "PENDING",
]);
const OrthoRatingEnum = z.enum([
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "BORDERLINE",
  "MILD",
  "MODERATE",
  "SEVERE",
  "NOT_EVALUABLE",
]);
const DnaTestSchema = z.object({
  disease: z.string().min(1).max(200),
  gene: z.string().max(50).optional(),
  result: GeneticResultEnum,
  laboratoryId: z.string().max(100).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  screenedAt: z.iso.datetime(),
  laboratoryName: z.string().max(200).optional(),
  dnaTests: z.array(DnaTestSchema).optional(),
  ofa_hips: OrthoRatingEnum.optional(),
  ofa_elbows: OrthoRatingEnum.optional(),
  ofa_patellas: OrthoRatingEnum.optional(),
  ofa_cardiac: z.string().max(200).optional(),
  ofa_eyes: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
  certificationExpiry: z.iso.datetime().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  screenedAt: true,
}).partial();
const ListQuerySchema = patientScopeQuery;
const RecordParamsSchema = orgParams.extend({ screenId: uuid() });

const { handler } = createClinicalHandlers(GeneticHealthScreenError);

export const GeneticHealthScreenController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list genetic health screens",
    run: ({ params, input }) =>
      GeneticHealthScreenService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create genetic health screen",
    run: ({ params, input, userId }) =>
      GeneticHealthScreenService.create({
        organisationId: params.organisationId,
        screenedBy: userId,
        ...input,
        screenedAt: new Date(input.screenedAt),
        certificationExpiry: input.certificationExpiry
          ? new Date(input.certificationExpiry)
          : undefined,
      }),
  }),

  get: handler({
    params: RecordParamsSchema,
    fallback: "Failed to get genetic health screen",
    run: ({ params }) =>
      GeneticHealthScreenService.get(params.screenId, params.organisationId),
  }),

  update: handler({
    params: RecordParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update genetic health screen",
    run: ({ params, input }) =>
      GeneticHealthScreenService.update(
        params.screenId,
        params.organisationId,
        {
          ...input,
          certificationExpiry: input.certificationExpiry
            ? new Date(input.certificationExpiry)
            : undefined,
        },
      ),
  }),

  delete: handler({
    params: RecordParamsSchema,
    status: 204,
    fallback: "Failed to delete genetic health screen",
    run: ({ params }) =>
      GeneticHealthScreenService.delete(params.screenId, params.organisationId),
  }),
};
