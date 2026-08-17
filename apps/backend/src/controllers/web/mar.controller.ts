import { z } from "zod";
import { MARService, MARError } from "src/services/mar.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const MARStatusEnum = z.enum([
  "SCHEDULED",
  "GIVEN",
  "HELD",
  "MISSED",
  "REFUSED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  prescriptionId: z.string().uuid().optional(),
  medicationName: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  route: z.string().min(1).max(100),
  scheduledAt: z.string().datetime(),
});

const AdministerBodySchema = z.object({
  administeredAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const HoldBodySchema = z.object({
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  status: MARStatusEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const EntryParamsSchema = orgParams.extend({ marEntryId: uuid() });

const { handler } = createClinicalHandlers(MARError);

export const MARController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list MAR entries",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return MARService.list({
        organisationId: params.organisationId,
        ...dateRange(from, to),
        ...rest,
      });
    },
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create MAR entry",
    run: ({ params, input, userId }) =>
      MARService.create({
        organisationId: params.organisationId,
        createdBy: userId,
        ...input,
        scheduledAt: new Date(input.scheduledAt),
      }),
  }),

  get: handler({
    params: EntryParamsSchema,
    fallback: "Failed to get MAR entry",
    run: ({ params }) =>
      MARService.get(params.marEntryId, params.organisationId),
  }),

  administer: handler({
    params: EntryParamsSchema,
    body: AdministerBodySchema,
    fallback: "Failed to administer MAR entry",
    run: ({ params, input, userId }) => {
      const { administeredAt, ...rest } = input;
      return MARService.administer(params.marEntryId, params.organisationId, {
        ...rest,
        administeredBy: userId,
        ...(administeredAt ? { administeredAt: new Date(administeredAt) } : {}),
      });
    },
  }),

  hold: handler({
    params: EntryParamsSchema,
    body: HoldBodySchema,
    fallback: "Failed to hold MAR entry",
    run: ({ params, input, userId }) =>
      MARService.hold(
        params.marEntryId,
        params.organisationId,
        input.notes,
        userId,
      ),
  }),

  markMissed: handler({
    params: EntryParamsSchema,
    body: HoldBodySchema,
    fallback: "Failed to mark MAR entry as missed",
    run: ({ params, input, userId }) =>
      MARService.markMissed(
        params.marEntryId,
        params.organisationId,
        input.notes,
        userId,
      ),
  }),
};
