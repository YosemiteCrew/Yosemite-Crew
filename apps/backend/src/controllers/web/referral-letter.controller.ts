import { z } from "zod";
import {
  ReferralLetterService,
  ReferralLetterError,
} from "src/services/referral-letter.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ReferralStatusEnum = z.enum([
  "DRAFT",
  "SIGNED",
  "SENT",
  "ACKNOWLEDGED",
  "CANCELLED",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.string().optional(),
  specialistName: z.string().max(200).optional(),
  specialistClinic: z.string().max(200).optional(),
  specialistEmail: z.email().optional(),
  reasonForReferral: z.string().min(1).max(5000),
  historySummary: z.string().max(5000).optional(),
  examFindings: z.string().max(5000).optional(),
  currentMedications: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  specialistName: z.string().max(200).optional(),
  specialistClinic: z.string().max(200).optional(),
  specialistEmail: z.email().optional(),
  reasonForReferral: z.string().min(1).max(5000).optional(),
  historySummary: z.string().max(5000).optional(),
  examFindings: z.string().max(5000).optional(),
  currentMedications: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.uuid().optional(),
  status: ReferralStatusEnum.optional(),
});

const LetterParamsSchema = orgParams.extend({ letterId: uuid() });

const { handler } = createClinicalHandlers(ReferralLetterError);

export const ReferralLetterController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list referral letters",
    run: ({ params, input }) =>
      ReferralLetterService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create referral letter",
    run: ({ params, input, userId }) =>
      ReferralLetterService.create({
        organisationId: params.organisationId,
        referringVetId: userId,
        ...input,
      }),
  }),

  get: handler({
    params: LetterParamsSchema,
    fallback: "Failed to get referral letter",
    run: ({ params }) =>
      ReferralLetterService.get(params.letterId, params.organisationId),
  }),

  update: handler({
    params: LetterParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update referral letter",
    run: ({ params, input }) =>
      ReferralLetterService.update(
        params.letterId,
        params.organisationId,
        input,
      ),
  }),

  sign: handler({
    params: LetterParamsSchema,
    fallback: "Failed to sign referral letter",
    run: ({ params, userId }) =>
      ReferralLetterService.sign(
        params.letterId,
        params.organisationId,
        userId,
      ),
  }),

  send: handler({
    params: LetterParamsSchema,
    fallback: "Failed to send referral letter",
    run: ({ params, userId }) =>
      ReferralLetterService.send(
        params.letterId,
        params.organisationId,
        userId,
      ),
  }),

  cancel: handler({
    params: LetterParamsSchema,
    fallback: "Failed to cancel referral letter",
    run: ({ params, userId }) =>
      ReferralLetterService.cancel(
        params.letterId,
        params.organisationId,
        userId,
      ),
  }),
};
