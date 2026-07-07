import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  TemplatePackService,
  TemplatePackServiceError,
} from "src/services/template-pack.service";
import { InvalidCursorError, clampLimit } from "src/utils/cursor-pagination";
import logger from "src/utils/logger";
import { resolveUserIdFromRequest } from "src/utils/request";

// Management plane (session auth): publisher lifecycle and install surface
// for template packs (plan: developer-portal-plugin-registry.md). Responses
// reuse the { data } / { message, code } envelopes of the sibling developer
// endpoints; all Prisma access lives in TemplatePackService.

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const respondMissingOrg = (res: Response): Response =>
  res.status(400).json({
    message: "Missing organisation context",
    code: "invalid_request",
  });

const respondInvalid = (
  res: Response,
  message = "Invalid request body",
): Response => res.status(400).json({ message, code: "invalid_request" });

const respondError = (
  res: Response,
  action: string,
  error: unknown,
): Response => {
  if (error instanceof TemplatePackServiceError) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, code: error.code });
  }
  if (error instanceof InvalidCursorError) {
    return respondInvalid(res, "Invalid pagination cursor");
  }
  logger.error(`TemplatePack ${action} failed`, { error });
  return res
    .status(500)
    .json({ message: "Internal server error", code: "internal_error" });
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CreatePackBody = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).regex(SLUG_PATTERN),
  description: z.string().trim().min(1).max(2000).optional(),
  templateIds: z.array(z.string().min(1)).min(1).max(50),
});

const CatalogQuery = z.object({
  limit: z.coerce.number().int().optional(),
  cursor: z.string().min(1).optional(),
});

export const TemplatePackController = {
  createPack: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    const parsed = CreatePackBody.safeParse(req.body);
    if (!parsed.success) {
      return respondInvalid(res);
    }
    // Duplicate ids would double-materialize on install; reject them here.
    if (
      new Set(parsed.data.templateIds).size !== parsed.data.templateIds.length
    ) {
      return respondInvalid(res, "Duplicate templateIds");
    }
    try {
      const pack = await TemplatePackService.create({
        publisherOrganisationId: organisationId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        templateIds: parsed.data.templateIds,
      });
      return res.status(201).json({ data: pack });
    } catch (error) {
      return respondError(res, "create", error);
    }
  },

  listPacks: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      const packs = await TemplatePackService.list(organisationId);
      return res.status(200).json({ data: packs });
    } catch (error) {
      return respondError(res, "list", error);
    }
  },

  publishPack: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      const pack = await TemplatePackService.publish(
        organisationId,
        req.params.id,
      );
      return res.status(200).json({ data: pack });
    } catch (error) {
      return respondError(res, "publish", error);
    }
  },

  getCatalog: async (req: Request, res: Response): Promise<Response> => {
    const parsed = CatalogQuery.safeParse(req.query);
    if (!parsed.success) {
      return respondInvalid(res, "Invalid query parameters");
    }
    try {
      const page = await TemplatePackService.catalog({
        limit: clampLimit(parsed.data.limit),
        cursor: parsed.data.cursor,
      });
      return res
        .status(200)
        .json({ data: page.items, pagination: page.pagination });
    } catch (error) {
      return respondError(res, "catalog", error);
    }
  },

  installPack: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    const installedBy = resolveUserIdFromRequest(req);
    if (!installedBy) {
      return respondInvalid(res, "Missing user context");
    }
    try {
      const install = await TemplatePackService.install({
        packId: req.params.id,
        organisationId,
        installedBy,
      });
      return res.status(201).json({ data: install });
    } catch (error) {
      return respondError(res, "install", error);
    }
  },

  uninstallPack: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      await TemplatePackService.uninstall({
        packId: req.params.id,
        organisationId,
      });
      return res.status(204).send();
    } catch (error) {
      return respondError(res, "uninstall", error);
    }
  },
};
