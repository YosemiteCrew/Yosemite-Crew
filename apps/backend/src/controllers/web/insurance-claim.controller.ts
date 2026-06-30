import type { Request, Response } from "express";
import { z } from "zod";
import {
  InsuranceClaimService,
  InsuranceClaimError,
} from "src/services/insurance-claim.service";
import type { OrgRequest } from "src/middlewares/rbac";

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

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ClaimParamsSchema = z.object({
  organisationId: z.string().uuid(),
  claimId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof InsuranceClaimError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const InsuranceClaimController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const claims = await InsuranceClaimService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(claims);
    } catch (err) {
      return handleError(err, res, "Failed to list insurance claims");
    }
  },

  create: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const claim = await InsuranceClaimService.create({
        organisationId: params.data.organisationId,
        createdBy: typedReq.userId ?? undefined,
        ...body.data,
      });
      return res.status(201).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to create insurance claim");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ClaimParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const claim = await InsuranceClaimService.get(
        params.data.claimId,
        params.data.organisationId,
      );
      return res.status(200).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to get insurance claim");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ClaimParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const claim = await InsuranceClaimService.update(
        params.data.claimId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to update insurance claim");
    }
  },

  submit: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ClaimParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const claim = await InsuranceClaimService.submit(
        params.data.claimId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to submit insurance claim");
    }
  },

  updateStatus: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ClaimParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateStatusBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const claim = await InsuranceClaimService.updateStatus(
        params.data.claimId,
        params.data.organisationId,
        { ...body.data, updatedBy: typedReq.userId ?? undefined },
      );
      return res.status(200).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to update claim status");
    }
  },

  cancel: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ClaimParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const claim = await InsuranceClaimService.cancel(
        params.data.claimId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(claim);
    } catch (err) {
      return handleError(err, res, "Failed to cancel insurance claim");
    }
  },
};
