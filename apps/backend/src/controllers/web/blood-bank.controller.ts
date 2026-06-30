import type { Request, Response } from "express";
import { z } from "zod";
import {
  BloodBankService,
  BloodBankError,
} from "src/services/blood-bank.service";
import type { OrgRequest } from "src/middlewares/rbac";

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
  isActive: z
    .string()
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined,
    ),
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

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const DonorParamsSchema = z.object({
  organisationId: z.string().uuid(),
  donorId: z.string().uuid(),
});
const DonationParamsSchema = z.object({
  organisationId: z.string().uuid(),
  donationId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof BloodBankError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const BloodBankController = {
  // Donors
  listDonors: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListDonorsQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const donors = await BloodBankService.listDonors({
        organisationId: params.data.organisationId,
        bloodType: query.data.bloodType,
        isActive: query.data.isActive,
      });
      return res.status(200).json(donors);
    } catch (err) {
      return handleError(err, res, "Failed to list blood donors");
    }
  },

  registerDonor: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RegisterDonorSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const donor = await BloodBankService.registerDonor({
        organisationId: params.data.organisationId,
        registeredBy: typedReq.userId ?? undefined,
        ...body.data,
        lastScreeningAt: body.data.lastScreeningAt
          ? new Date(body.data.lastScreeningAt)
          : undefined,
      });
      return res.status(201).json(donor);
    } catch (err) {
      return handleError(err, res, "Failed to register blood donor");
    }
  },

  getDonor: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DonorParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const donor = await BloodBankService.getDonor(
        params.data.donorId,
        params.data.organisationId,
      );
      return res.status(200).json(donor);
    } catch (err) {
      return handleError(err, res, "Failed to get blood donor");
    }
  },

  updateDonor: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DonorParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateDonorSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const donor = await BloodBankService.updateDonor(
        params.data.donorId,
        params.data.organisationId,
        {
          ...body.data,
          lastScreeningAt: body.data.lastScreeningAt
            ? new Date(body.data.lastScreeningAt)
            : undefined,
          lastDonationAt: body.data.lastDonationAt
            ? new Date(body.data.lastDonationAt)
            : undefined,
          nextEligibleAt: body.data.nextEligibleAt
            ? new Date(body.data.nextEligibleAt)
            : undefined,
        },
      );
      return res.status(200).json(donor);
    } catch (err) {
      return handleError(err, res, "Failed to update blood donor");
    }
  },

  // Donations / collections
  listDonations: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListDonationsQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const donations = await BloodBankService.listDonations({
        organisationId: params.data.organisationId,
        donorId: query.data.donorId,
        status: query.data.status,
      });
      return res.status(200).json(donations);
    } catch (err) {
      return handleError(err, res, "Failed to list blood donations");
    }
  },

  recordDonation: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RecordDonationSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const donation = await BloodBankService.recordDonation({
        organisationId: params.data.organisationId,
        collectedBy: typedReq.userId ?? undefined,
        ...body.data,
        collectedAt: new Date(body.data.collectedAt),
        expiresAt: body.data.expiresAt
          ? new Date(body.data.expiresAt)
          : undefined,
      });
      return res.status(201).json(donation);
    } catch (err) {
      return handleError(err, res, "Failed to record blood donation");
    }
  },

  getDonation: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DonationParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const donation = await BloodBankService.getDonation(
        params.data.donationId,
        params.data.organisationId,
      );
      return res.status(200).json(donation);
    } catch (err) {
      return handleError(err, res, "Failed to get blood donation");
    }
  },

  updateDonation: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DonationParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateDonationSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const donation = await BloodBankService.updateDonation(
        params.data.donationId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(donation);
    } catch (err) {
      return handleError(err, res, "Failed to update blood donation");
    }
  },
};
