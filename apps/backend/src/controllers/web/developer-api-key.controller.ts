/*
 * These routes are scoped to the DEVELOPER, not to a practice.
 *
 * They were gated on `withOrgPermissions()` and keyed on an organisation, which
 * the portal's own audience never has: signing up through the developer door
 * grants the `developer` role and nothing else, there is no developer entry in
 * the RBAC role model, and no UserOrganization row is created. Every request
 * from such an account failed on the org middleware before reaching a handler.
 * See issue #2551.
 *
 * The caller's own verified id is the owner. `resolveVerifiedUserId` reads only
 * the session (`utils/request.ts` deliberately dropped its `x-user-id` header
 * fallback), so the owner cannot be spoofed by a header the way an org could be.
 */
import { Request, Response } from "express";
import { z } from "zod";
import { DeveloperApiKeyEnvironment } from "@prisma/client";
import {
  DeveloperApiKeyService,
  DeveloperApiKeyServiceError,
} from "../../services/developer-api-key.service";
import logger from "../../utils/logger";
import { resolveVerifiedUserId } from "src/utils/request";

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.string().trim().min(1)).max(50).optional(),
  environment: z.enum(DeveloperApiKeyEnvironment).optional(),
  expiresAt: z.iso.datetime().optional(),
});

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
      const ownerUserId = resolveVerifiedUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = CreateApiKeySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: z.flattenError(parsed.error),
        });
      }

      const { name, scopes, environment, expiresAt } = parsed.data;
      const issued = await DeveloperApiKeyService.issue({
        ownerUserId,
        name,
        createdBy: ownerUserId,
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
      const ownerUserId = resolveVerifiedUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const keys = await DeveloperApiKeyService.list(ownerUserId);
      return res.status(200).json({ data: keys });
    } catch (error) {
      return handleError(res, error, "list");
    }
  },

  revokeApiKey: async (req: Request, res: Response): Promise<Response> => {
    try {
      const ownerUserId = resolveVerifiedUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      await DeveloperApiKeyService.revoke({
        ownerUserId,
        keyId: req.params.keyId,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "revoke");
    }
  },
};
