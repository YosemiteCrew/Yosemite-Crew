import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  PassportConsentService,
  PassportConsentError,
} from "src/services/passport-consent.service";
import { OrgRequest } from "src/middlewares/rbac";

const IdSchema = z.string().min(1).max(64);

const OrgParamsSchema = z.object({ organisationId: IdSchema });
const CompanionParamsSchema = z.object({
  organisationId: IdSchema,
  patientId: IdSchema,
});
const ConsentParamsSchema = z.object({
  organisationId: IdSchema,
  consentId: IdSchema,
});

const RequestBodySchema = z.object({
  recipientOrganisationId: IdSchema,
  purpose: z.string().max(500).optional(),
});
const GrantBodySchema = z.object({
  method: z.enum(["MOBILE", "EMAIL"]),
  parentId: IdSchema.optional(),
});
const RevokeBodySchema = z.object({ reason: z.string().max(500).optional() });

const permissionsLoaded = (req: OrgRequest, res: Response): boolean => {
  if (req.userPermissions) return true;
  res.status(500).json({
    message:
      "Permissions not loaded. Include withOrgPermissions before handler.",
  });
  return false;
};

const handleError = (
  err: unknown,
  res: Response,
  context: string,
): Response => {
  if (err instanceof PassportConsentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  logger.error(context, err);
  return res.status(500).json({ message: "Internal Server Error" });
};

export const PassportConsentController = {
  requestConsent: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = CompanionParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = RequestBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const consent = await PassportConsentService.requestConsent({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        recipientOrganisationId: body.data.recipientOrganisationId,
        purpose: body.data.purpose,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
      });
      return res.status(201).json(consent);
    } catch (err) {
      return handleError(err, res, "Consent request failed");
    }
  },

  grantConsent: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ConsentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = GrantBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const consent = await PassportConsentService.grantConsent({
        consentId: params.data.consentId,
        organisationId: params.data.organisationId,
        method: body.data.method,
        parentId: body.data.parentId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
      });
      return res.status(200).json(consent);
    } catch (err) {
      return handleError(err, res, "Consent grant failed");
    }
  },

  revokeConsent: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ConsentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = RevokeBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const consent = await PassportConsentService.revokeConsent({
        consentId: params.data.consentId,
        organisationId: params.data.organisationId,
        reason: body.data.reason,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
      });
      return res.status(200).json(consent);
    } catch (err) {
      return handleError(err, res, "Consent revocation failed");
    }
  },

  listConsents: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const consents = await PassportConsentService.listConsents(
        params.data.organisationId,
      );
      return res.status(200).json(consents);
    } catch (err) {
      return handleError(err, res, "Consent listing failed");
    }
  },
};
