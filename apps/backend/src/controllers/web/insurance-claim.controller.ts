import { z } from "zod";
import {
  InsuranceClaimService,
  InsuranceClaimError,
} from "src/services/insurance-claim.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const ClaimStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "PAID",
  "CANCELLED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  invoiceId: z.string().optional(),
  encounterId: z.string().optional(),
  insurerName: z.string().min(1).max(200),
  policyNumber: z.string().min(1).max(100),
  submittedAmount: z.number().positive(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  insurerName: z.string().min(1).max(200).optional(),
  policyNumber: z.string().min(1).max(100).optional(),
  claimNumber: z.string().max(100).optional(),
  submittedAmount: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
  externalClaimRef: z.string().max(200).optional(),
});

const UpdateStatusBodySchema = z.object({
  status: ClaimStatusEnum,
  approvedAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  rejectionReason: z.string().max(1000).optional(),
  claimNumber: z.string().max(100).optional(),
  externalClaimRef: z.string().max(200).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: ClaimStatusEnum.optional(),
  invoiceId: z.string().optional(),
});

const ClaimParamsSchema = orgParams.extend({ claimId: uuid() });

const { handler } = createClinicalHandlers(InsuranceClaimError);

export const InsuranceClaimController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list insurance claims",
    run: ({ params, input }) =>
      InsuranceClaimService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create insurance claim",
    run: ({ params, input, userId }) =>
      InsuranceClaimService.create({
        organisationId: params.organisationId,
        createdBy: userId,
        ...input,
      }),
  }),

  get: handler({
    params: ClaimParamsSchema,
    fallback: "Failed to get insurance claim",
    run: ({ params }) =>
      InsuranceClaimService.get(params.claimId, params.organisationId),
  }),

  update: handler({
    params: ClaimParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update insurance claim",
    run: ({ params, input }) =>
      InsuranceClaimService.update(
        params.claimId,
        params.organisationId,
        input,
      ),
  }),

  submit: handler({
    params: ClaimParamsSchema,
    fallback: "Failed to submit insurance claim",
    run: ({ params, userId }) =>
      InsuranceClaimService.submit(
        params.claimId,
        params.organisationId,
        userId,
      ),
  }),

  updateStatus: handler({
    params: ClaimParamsSchema,
    body: UpdateStatusBodySchema,
    fallback: "Failed to update claim status",
    run: ({ params, input, userId }) =>
      InsuranceClaimService.updateStatus(
        params.claimId,
        params.organisationId,
        { ...input, updatedBy: userId },
      ),
  }),

  cancel: handler({
    params: ClaimParamsSchema,
    fallback: "Failed to cancel insurance claim",
    run: ({ params, userId }) =>
      InsuranceClaimService.cancel(
        params.claimId,
        params.organisationId,
        userId,
      ),
  }),
};
