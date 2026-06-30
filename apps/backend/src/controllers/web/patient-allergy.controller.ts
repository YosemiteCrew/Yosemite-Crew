import type { Request, Response } from "express";
import { z } from "zod";
import {
  PatientAllergyService,
  PatientAllergyError,
} from "src/services/patient-allergy.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AllergyTypeEnum = z.enum(["DRUG", "FOOD", "ENVIRONMENTAL", "OTHER"]);
const AllergySeverityEnum = z.enum([
  "MILD",
  "MODERATE",
  "SEVERE",
  "LIFE_THREATENING",
]);
const AllergyStatusEnum = z.enum(["ACTIVE", "RESOLVED", "UNCONFIRMED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  allergen: z.string().min(1).max(200),
  allergyType: AllergyTypeEnum,
  severity: AllergySeverityEnum,
  reaction: z.string().max(1000).optional(),
  status: AllergyStatusEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  allergen: z.string().min(1).max(200).optional(),
  allergyType: AllergyTypeEnum.optional(),
  severity: AllergySeverityEnum.optional(),
  reaction: z.string().max(1000).optional(),
  status: AllergyStatusEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  resolvedDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ResolveBodySchema = z.object({
  resolvedDate: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: AllergyStatusEnum.optional(),
  allergyType: AllergyTypeEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const AllergyParamsSchema = z.object({
  organisationId: z.string().uuid(),
  allergyId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PatientAllergyError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PatientAllergyController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const allergies = await PatientAllergyService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(allergies);
    } catch (err) {
      return handleError(err, res, "Failed to list allergies");
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
      const { onsetDate, ...rest } = body.data;
      const allergy = await PatientAllergyService.create({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
        ...rest,
      });
      return res.status(201).json(allergy);
    } catch (err) {
      return handleError(err, res, "Failed to create allergy record");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AllergyParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const allergy = await PatientAllergyService.get(
        params.data.allergyId,
        params.data.organisationId,
      );
      return res.status(200).json(allergy);
    } catch (err) {
      return handleError(err, res, "Failed to get allergy record");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = AllergyParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { onsetDate, resolvedDate, ...rest } = body.data;
      const allergy = await PatientAllergyService.update(
        params.data.allergyId,
        params.data.organisationId,
        {
          ...rest,
          ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
          ...(resolvedDate ? { resolvedDate: new Date(resolvedDate) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(allergy);
    } catch (err) {
      return handleError(err, res, "Failed to update allergy record");
    }
  },

  resolve: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = AllergyParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ResolveBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const allergy = await PatientAllergyService.resolve(
        params.data.allergyId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
        body.data.resolvedDate ? new Date(body.data.resolvedDate) : undefined,
      );
      return res.status(200).json(allergy);
    } catch (err) {
      return handleError(err, res, "Failed to resolve allergy record");
    }
  },
};
