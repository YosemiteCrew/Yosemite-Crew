import { z } from "zod";
import { WaitlistService, WaitlistError } from "src/services/waitlist.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const WaitlistStatusEnum = z.enum([
  "WAITING",
  "OFFERED",
  "BOOKED",
  "CANCELLED",
  "EXPIRED",
]);

const AddBodySchema = z.object({
  patientId: z.uuid(),
  preferredLeadId: z.uuid().optional(),
  appointmentType: z.string().max(100).optional(),
  earliestDate: z.iso.datetime().optional(),
  latestDate: z.iso.datetime().optional(),
  notes: z.string().max(500).optional(),
  expiresAt: z.iso.datetime().optional(),
});

const ListQuerySchema = z.object({
  status: WaitlistStatusEnum.optional(),
  patientId: z.uuid().optional(),
  appointmentType: z.string().max(100).optional(),
});

const EntryParamsSchema = orgParams.extend({ entryId: uuid() });

const { handler } = createClinicalHandlers(WaitlistError);

export const WaitlistController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list waitlist entries",
    run: ({ params, input }) =>
      WaitlistService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  add: handler({
    params: orgParams,
    body: AddBodySchema,
    status: 201,
    fallback: "Failed to add waitlist entry",
    run: ({ params, input, userId }) =>
      WaitlistService.add({
        organisationId: params.organisationId,
        requestedBy: userId,
        ...input,
        earliestDate: input.earliestDate
          ? new Date(input.earliestDate)
          : undefined,
        latestDate: input.latestDate ? new Date(input.latestDate) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }),
  }),

  get: handler({
    params: EntryParamsSchema,
    fallback: "Failed to get waitlist entry",
    run: ({ params }) =>
      WaitlistService.get(params.entryId, params.organisationId),
  }),

  offer: handler({
    params: EntryParamsSchema,
    fallback: "Failed to offer slot",
    run: ({ params, userId }) =>
      WaitlistService.offer(params.entryId, params.organisationId, userId),
  }),

  book: handler({
    params: EntryParamsSchema,
    fallback: "Failed to book waitlist entry",
    run: ({ params, userId }) =>
      WaitlistService.book(params.entryId, params.organisationId, userId),
  }),

  cancel: handler({
    params: EntryParamsSchema,
    fallback: "Failed to cancel waitlist entry",
    run: ({ params, userId }) =>
      WaitlistService.cancel(params.entryId, params.organisationId, userId),
  }),

  expireStale: handler({
    params: orgParams,
    fallback: "Failed to expire stale entries",
    run: ({ params }) => WaitlistService.expireStale(params.organisationId),
  }),
};
