import { Request, Response } from "express";
import { z } from "zod";
import { DeveloperApiKeyEnvironment } from "@prisma/client";
import {
  DeveloperApiKeyService,
  DeveloperApiKeyServiceError,
} from "../../services/developer-api-key.service";
import logger from "../../utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import { resolveUserIdFromRequest } from "src/utils/request";

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.string().trim().min(1)).max(50).optional(),
  environment: z.nativeEnum(DeveloperApiKeyEnvironment).optional(),
  expiresAt: z.string().datetime().optional(),
});

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const handleError = (
  res: Response,
  error: unknown,
  action: string,
): Response => {
  if (error instanceof DeveloperApiKeyServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(`DeveloperApiKey ${action} failed`, { error });
  return res.status(500).json({ message: "Internal server error" });
};

export const DeveloperApiKeyController = {
  createApiKey: async (req: Request, res: Response): Promise<Response> => {
    try {
      const organisationId = getOrgId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }
      const createdBy = resolveUserIdFromRequest(req);
      if (!createdBy) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = CreateApiKeySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const { name, scopes, environment, expiresAt } = parsed.data;
      const issued = await DeveloperApiKeyService.issue({
        organisationId,
        name,
        createdBy,
        scopes,
        environment,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      return res.status(201).json(issued);
    } catch (error) {
      return handleError(res, error, "create");
    }
  },

  listApiKeys: async (req: Request, res: Response): Promise<Response> => {
    try {
      const organisationId = getOrgId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }
      const keys = await DeveloperApiKeyService.list(organisationId);
      return res.status(200).json({ data: keys });
    } catch (error) {
      return handleError(res, error, "list");
    }
  },

  revokeApiKey: async (req: Request, res: Response): Promise<Response> => {
    try {
      const organisationId = getOrgId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }
      await DeveloperApiKeyService.revoke({
        organisationId,
        keyId: req.params.keyId,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "revoke");
    }
  },
};
