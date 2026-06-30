import type { Request, Response } from "express";
import { z } from "zod";
import {
  ReferralLetterService,
  ReferralLetterError,
} from "src/services/referral-letter.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ReferralStatusEnum = z.enum([
  "DRAFT",
  "SIGNED",
  "SENT",
  "ACKNOWLEDGED",
  "CANCELLED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().optional(),
  specialistName: z.string().max(200).optional(),
  specialistClinic: z.string().max(200).optional(),
  specialistEmail: z.string().email().optional(),
  reasonForReferral: z.string().min(1).max(5000),
  historySummary: z.string().max(5000).optional(),
  examFindings: z.string().max(5000).optional(),
  currentMedications: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  specialistName: z.string().max(200).optional(),
  specialistClinic: z.string().max(200).optional(),
  specialistEmail: z.string().email().optional(),
  reasonForReferral: z.string().min(1).max(5000).optional(),
  historySummary: z.string().max(5000).optional(),
  examFindings: z.string().max(5000).optional(),
  currentMedications: z.string().max(2000).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: ReferralStatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const LetterParamsSchema = z.object({
  organisationId: z.string().uuid(),
  letterId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof ReferralLetterError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const ReferralLetterController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const letters = await ReferralLetterService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(letters);
    } catch (err) {
      return handleError(err, res, "Failed to list referral letters");
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
      const letter = await ReferralLetterService.create({
        organisationId: params.data.organisationId,
        referringVetId: typedReq.userId ?? undefined,
        ...body.data,
      });
      return res.status(201).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to create referral letter");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = LetterParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const letter = await ReferralLetterService.get(
        params.data.letterId,
        params.data.organisationId,
      );
      return res.status(200).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to get referral letter");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = LetterParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const letter = await ReferralLetterService.update(
        params.data.letterId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to update referral letter");
    }
  },

  sign: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = LetterParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const letter = await ReferralLetterService.sign(
        params.data.letterId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to sign referral letter");
    }
  },

  send: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = LetterParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const letter = await ReferralLetterService.send(
        params.data.letterId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to send referral letter");
    }
  },

  cancel: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = LetterParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const letter = await ReferralLetterService.cancel(
        params.data.letterId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(letter);
    } catch (err) {
      return handleError(err, res, "Failed to cancel referral letter");
    }
  },
};
