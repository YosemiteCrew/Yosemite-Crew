import { z } from "zod";
import {
  BloodTransfusionService,
  BloodTransfusionError,
} from "src/services/blood-transfusion.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const BloodTypeEnum = z.enum([
  "DEA_1_POSITIVE",
  "DEA_1_NEGATIVE",
  "TYPE_A",
  "TYPE_B",
  "TYPE_AB",
  "UNKNOWN",
]);
const ReactionEnum = z.enum([
  "NONE",
  "FEBRILE",
  "HAEMOLYTIC",
  "ALLERGIC",
  "ANAPHYLACTIC",
  "CIRCULATORY_OVERLOAD",
  "OTHER",
]);

const RecordBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  donorId: z.string().max(200).optional(),
  productType: z.string().min(1).max(200),
  bloodType: BloodTypeEnum,
  volumeMl: z.number().positive(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reaction: ReactionEnum.optional(),
  reactionNotes: z.string().max(2000).optional(),
  crossMatchDone: z.boolean().optional(),
  crossMatchResult: z.string().max(500).optional(),
  preTransfusionPCV: z.number().min(0).max(100).optional(),
  postTransfusionPCV: z.number().min(0).max(100).optional(),
});

const ReactionBodySchema = z.object({
  reaction: ReactionEnum,
  reactionNotes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  endedAt: z.iso.datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reaction: ReactionEnum.optional(),
  reactionNotes: z.string().max(2000).optional(),
  crossMatchResult: z.string().max(500).optional(),
  postTransfusionPCV: z.number().min(0).max(100).optional(),
});

const ListQuerySchema = patientScopeQuery;

const TransfusionParamsSchema = orgParams.extend({ transfusionId: uuid() });

const parseDates = (data: {
  startedAt?: string;
  endedAt?: string;
  [key: string]: unknown;
}) => ({
  ...data,
  ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
  ...(data.endedAt ? { endedAt: new Date(data.endedAt) } : {}),
});

const { handler } = createClinicalHandlers(BloodTransfusionError);

export const BloodTransfusionController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list transfusions",
    run: ({ params, input }) =>
      BloodTransfusionService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  record: handler({
    params: orgParams,
    body: RecordBodySchema,
    status: 201,
    fallback: "Failed to record transfusion",
    run: ({ params, input, userId }) =>
      BloodTransfusionService.record({
        organisationId: params.organisationId,
        administeredBy: userId,
        ...parseDates(input),
      } as Parameters<typeof BloodTransfusionService.record>[0]),
  }),

  get: handler({
    params: TransfusionParamsSchema,
    fallback: "Failed to get transfusion",
    run: ({ params }) =>
      BloodTransfusionService.get(params.transfusionId, params.organisationId),
  }),

  reportReaction: handler({
    params: TransfusionParamsSchema,
    body: ReactionBodySchema,
    fallback: "Failed to report reaction",
    run: ({ params, input, userId }) =>
      BloodTransfusionService.reportReaction(
        params.transfusionId,
        params.organisationId,
        input,
        userId,
      ),
  }),

  update: handler({
    params: TransfusionParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update transfusion",
    run: ({ params, input }) => {
      const { endedAt, ...rest } = input;
      return BloodTransfusionService.update(
        params.transfusionId,
        params.organisationId,
        {
          ...rest,
          ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
        },
      );
    },
  }),
};
