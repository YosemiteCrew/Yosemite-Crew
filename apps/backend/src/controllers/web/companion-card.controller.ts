import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  CompanionCardService,
  CompanionCardServiceError,
} from "src/services/companion-card.service";
import { OrgRequest } from "src/middlewares/rbac";

// Ids in this codebase may be Mongo ObjectIds or Postgres UUIDs (dual-write), so
// validate leniently and let the data lookup decide existence.
const IdSchema = z.string().min(1).max(64);

const ParamsSchema = z.object({
  organisationId: IdSchema,
  patientId: IdSchema,
});

const RevokeParamsSchema = z.object({
  organisationId: IdSchema,
  tokenId: IdSchema,
});

// Tokens are only minted for audiences reached without Cognito; STAFF and OWNER
// authenticate directly, so they are not issuable here.
const IssueBodySchema = z.object({
  audience: z.enum(["PUBLIC", "REFERRAL_CLINIC"]),
  ttlSeconds: z.number().int().positive().optional(),
  showOwnerPhone: z.boolean().optional(),
});

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
  if (err instanceof CompanionCardServiceError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  logger.error(context, err);
  return res.status(500).json({ message: "Internal Server Error" });
};

export const CompanionCardController = {
  issueShareToken: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = IssueBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const result = await CompanionCardService.issueShareToken({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        audience: body.data.audience,
        ttlSeconds: body.data.ttlSeconds,
        showOwnerPhone: body.data.showOwnerPhone,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
      });
      return res.status(201).json(result);
    } catch (err) {
      return handleError(err, res, "Companion card share issuance failed");
    }
  },

  listTokens: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const tokens = await CompanionCardService.listTokens(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json({ tokens });
    } catch (err) {
      return handleError(err, res, "Companion card token listing failed");
    }
  },

  revokeToken: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = RevokeParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const share = await CompanionCardService.revokeToken(
        params.data.tokenId,
        params.data.organisationId,
        { type: "PMS_USER", id: typedReq.userId ?? null },
      );
      return res.status(200).json(share);
    } catch (err) {
      return handleError(err, res, "Companion card share revocation failed");
    }
  },

  // Public, unauthenticated. Org scope comes from the token row, never the
  // request. The service returns a uniform not-found for missing/expired/revoked.
  getByPublicToken: async (req: Request, res: Response): Promise<Response> => {
    try {
      const token =
        typeof req.params.token === "string" ? req.params.token : "";
      const card = await CompanionCardService.resolveByRawToken(token);
      return res.status(200).json(card);
    } catch (err) {
      if (err instanceof CompanionCardServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Public companion card resolve failed", err);
      return res.status(404).json({ message: "Card not found." });
    }
  },
};
