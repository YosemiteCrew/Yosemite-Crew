import { Request, Response } from "express";
import { z } from "zod";
import {
  PassportConsentService,
  PassportConsentError,
} from "src/services/passport-consent.service";
import { OrgRequest } from "src/middlewares/rbac";
import {
  createOrgErrorHandler,
  permissionsLoaded,
} from "src/controllers/web/shared/org-controller.helpers";

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
// parentId is deliberately NOT accepted: it is derived from the authenticated
// parent link so the consent audit trail cannot be attributed to a fabricated
// pet owner.
const GrantBodySchema = z.object({
  method: z.enum(["MOBILE", "EMAIL"]),
});
const RevokeBodySchema = z.object({ reason: z.string().max(500).optional() });

const handleError = createOrgErrorHandler(PassportConsentError);
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

  /**
   * Pet-parent action, not a practice action. Mounted behind mobile auth: the
   * service re-checks that the authenticated user is the pet's primary parent,
   * so a staff session can never grant a practice access to another practice's
   * clinical records.
   */
  grantConsent: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
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
        grantingUserId: typedReq.userId ?? null,
        actor: { type: "PARENT", id: typedReq.userId ?? null },
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
