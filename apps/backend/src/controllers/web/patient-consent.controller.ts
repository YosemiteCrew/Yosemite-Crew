import type { Request, Response } from "express";
import { z } from "zod";
import {
  PatientConsentService,
  PatientConsentError,
} from "src/services/patient-consent.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ConsentTypeEnum = z.enum([
  "SURGICAL",
  "ANESTHESIA",
  "DIAGNOSTIC",
  "TREATMENT",
  "DATA_SHARING",
  "DNR",
  "OTHER",
]);
const ConsentStatusEnum = z.enum(["ACTIVE", "REVOKED", "EXPIRED"]);

const GrantBodySchema = z.object({
  patientId: z.string().uuid(),
  consentType: ConsentTypeEnum,
  procedureDesc: z.string().max(2000).optional(),
  consentedBy: z.string().max(200).optional(),
  consentedByName: z.string().max(200).optional(),
  consentedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  witnessedBy: z.string().max(200).optional(),
  documentId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const RevokeBodySchema = z.object({
  revokedReason: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: ConsentStatusEnum.optional(),
  consentType: ConsentTypeEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ConsentParamsSchema = z.object({
  organisationId: z.string().uuid(),
  consentId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PatientConsentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PatientConsentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await PatientConsentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list consents");
    }
  },

  grant: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = GrantBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { consentedAt, expiresAt, ...rest } = body.data;
      const record = await PatientConsentService.grant({
        organisationId: params.data.organisationId,
        ...(typedReq.userId ? { consentedBy: typedReq.userId } : {}),
        ...rest,
        ...(consentedAt ? { consentedAt: new Date(consentedAt) } : {}),
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to grant consent");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ConsentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await PatientConsentService.get(
        params.data.consentId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get consent");
    }
  },

  revoke: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ConsentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RevokeBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await PatientConsentService.revoke(
        params.data.consentId,
        params.data.organisationId,
        body.data.revokedReason,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to revoke consent");
    }
  },
};
