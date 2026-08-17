import { z } from "zod";
import {
  BloodBankService,
  BloodBankError,
} from "src/services/blood-bank.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";
import { parseOptionalBooleanFlag } from "src/utils/query-flags";

const BloodTypeEnum = z.enum([
  "DEA_1_POSITIVE",
  "DEA_1_NEGATIVE",
  "TYPE_A",
  "TYPE_B",
  "TYPE_AB",
  "UNKNOWN",
]);
const DonationStatusEnum = z.enum([
  "COLLECTED",
  "PROCESSED",
  "AVAILABLE",
  "TRANSFUSED",
  "EXPIRED",
  "DISCARDED",
]);
const CrossmatchSchema = z.object({
  recipientId: z.string().max(100),
  compatible: z.boolean(),
  testedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

const RegisterDonorSchema = z.object({
  patientId: z.string().uuid(),
  bloodType: BloodTypeEnum,
  lastScreeningAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateDonorSchema = z.object({
  bloodType: BloodTypeEnum.optional(),
  lastScreeningAt: z.string().datetime().optional(),
  lastDonationAt: z.string().datetime().optional(),
  nextEligibleAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  totalDonations: z.number().int().min(0).optional(),
  disqualificationReason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const ListDonorsQuerySchema = z.object({
  bloodType: BloodTypeEnum.optional(),
  isActive: z.string().optional().transform(parseOptionalBooleanFlag),
});

const RecordDonationSchema = z.object({
  donorId: z.string().uuid(),
  collectedAt: z.string().datetime(),
  volumeMl: z.number().positive(),
  anticoagulant: z.string().max(100).optional(),
  unitId: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  crossmatchResults: z.array(CrossmatchSchema).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateDonationSchema = z.object({
  status: DonationStatusEnum.optional(),
  crossmatchResults: z.array(CrossmatchSchema).optional(),
  notes: z.string().max(2000).optional(),
});

const ListDonationsQuerySchema = z.object({
  donorId: z.string().uuid().optional(),
  status: DonationStatusEnum.optional(),
});

const DonorParamsSchema = orgParams.extend({ donorId: uuid() });
const DonationParamsSchema = orgParams.extend({ donationId: uuid() });

const { handler } = createClinicalHandlers(BloodBankError);

export const BloodBankController = {
  // Donors
  listDonors: handler({
    params: orgParams,
    query: ListDonorsQuerySchema,
    fallback: "Failed to list blood donors",
    run: ({ params, input }) =>
      BloodBankService.listDonors({
        organisationId: params.organisationId,
        bloodType: input.bloodType,
        isActive: input.isActive,
      }),
  }),

  registerDonor: handler({
    params: orgParams,
    body: RegisterDonorSchema,
    status: 201,
    fallback: "Failed to register blood donor",
    run: ({ params, input, userId }) =>
      BloodBankService.registerDonor({
        organisationId: params.organisationId,
        registeredBy: userId,
        ...input,
        lastScreeningAt: input.lastScreeningAt
          ? new Date(input.lastScreeningAt)
          : undefined,
      }),
  }),

  getDonor: handler({
    params: DonorParamsSchema,
    fallback: "Failed to get blood donor",
    run: ({ params }) =>
      BloodBankService.getDonor(params.donorId, params.organisationId),
  }),

  updateDonor: handler({
    params: DonorParamsSchema,
    body: UpdateDonorSchema,
    fallback: "Failed to update blood donor",
    run: ({ params, input }) =>
      BloodBankService.updateDonor(params.donorId, params.organisationId, {
        ...input,
        lastScreeningAt: input.lastScreeningAt
          ? new Date(input.lastScreeningAt)
          : undefined,
        lastDonationAt: input.lastDonationAt
          ? new Date(input.lastDonationAt)
          : undefined,
        nextEligibleAt: input.nextEligibleAt
          ? new Date(input.nextEligibleAt)
          : undefined,
      }),
  }),

  // Donations / collections
  listDonations: handler({
    params: orgParams,
    query: ListDonationsQuerySchema,
    fallback: "Failed to list blood donations",
    run: ({ params, input }) =>
      BloodBankService.listDonations({
        organisationId: params.organisationId,
        donorId: input.donorId,
        status: input.status,
      }),
  }),

  recordDonation: handler({
    params: orgParams,
    body: RecordDonationSchema,
    status: 201,
    fallback: "Failed to record blood donation",
    run: ({ params, input, userId }) =>
      BloodBankService.recordDonation({
        organisationId: params.organisationId,
        collectedBy: userId,
        ...input,
        collectedAt: new Date(input.collectedAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }),
  }),

  getDonation: handler({
    params: DonationParamsSchema,
    fallback: "Failed to get blood donation",
    run: ({ params }) =>
      BloodBankService.getDonation(params.donationId, params.organisationId),
  }),

  updateDonation: handler({
    params: DonationParamsSchema,
    body: UpdateDonationSchema,
    fallback: "Failed to update blood donation",
    run: ({ params, input }) =>
      BloodBankService.updateDonation(
        params.donationId,
        params.organisationId,
        input,
      ),
  }),
};
