import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  createTemplateInstanceSchema,
  createTemplateSchema,
  TemplateService,
  TemplateServiceError,
  updateTemplateCatalogLinksSchema,
  updateTemplateInstanceSchema,
  updateTemplateSchema,
} from "src/services/template.service";
import { z } from "zod";
import { TemplateKind, TemplateScope, TemplateStatus } from "@prisma/client";

const listQuerySchema = z.object({
  kind: z.nativeEnum(TemplateKind).optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  scope: z.nativeEnum(TemplateScope).optional(),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TemplateServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

export const TemplateController = {
  async create(
    req: Request<ParamsDictionary, unknown, unknown>,
    res: Response,
  ) {
    try {
      const userId = resolveUserId(req);
      const body = createTemplateSchema.parse({
        ...((req.body ?? {}) as Record<string, unknown>),
        createdBy: userId,
        updatedBy: userId,
      });
      const template = await TemplateService.create(body);
      return res.status(201).json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(
    req: Request<ParamsDictionary, unknown, unknown>,
    res: Response,
  ) {
    try {
      const userId = resolveUserId(req);
      const body = updateTemplateSchema.parse({
        ...((req.body ?? {}) as Record<string, unknown>),
        updatedBy: userId,
      });
      const template = await TemplateService.update(
        req.params.templateId,
        body,
        req.params.organisationId,
      );
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async publish(req: Request, res: Response) {
    try {
      const template = await TemplateService.publish(
        req.params.templateId,
        resolveUserId(req),
        req.params.organisationId,
      );
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const template = await TemplateService.archive(
        req.params.templateId,
        resolveUserId(req),
        req.params.organisationId,
      );
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateCatalogLinks(req: Request, res: Response) {
    try {
      const body = updateTemplateCatalogLinksSchema.parse(req.body);
      const template = await TemplateService.updateCatalogLinks(
        req.params.templateId,
        body,
        req.params.organisationId,
      );
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async list(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const organisationId =
        (req.params.organisationId as string | undefined) ??
        (req.query.organisationId as string | undefined) ??
        "";
      const templates = await TemplateService.listForOrganisation(
        organisationId,
        query,
      );
      return res.json(templates);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listLibrary(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = await TemplateService.listLibrary(query);
      return res.json(templates);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listOrganisationTemplates(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = await TemplateService.listForOrganisation(
        req.params.organisationId,
        query,
      );
      return res.json(templates);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listUserTemplates(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const userId = resolveUserId(req);
      const templates = await TemplateService.listForUser(
        req.params.organisationId,
        userId,
        query,
      );
      return res.json(templates);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const template = await TemplateService.getById(
        req.params.templateId,
        req.params.organisationId,
      );
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createInstance(req: Request, res: Response) {
    try {
      const body = createTemplateInstanceSchema.parse(req.body);
      const instance = await TemplateService.createInstance({
        ...body,
        templateId: req.params.templateId,
      });
      return res.status(201).json(instance);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateInstance(req: Request, res: Response) {
    try {
      const body = updateTemplateInstanceSchema.parse(req.body);
      const instance = await TemplateService.updateInstance(
        req.params.instanceId,
        body,
        req.params.organisationId,
      );
      return res.json(instance);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async submitInstance(req: Request, res: Response) {
    try {
      const submittedBy = resolveUserId(req);
      const instance = await TemplateService.submitInstance(
        req.params.instanceId,
        req.params.organisationId,
        submittedBy,
      );
      return res.json(instance);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
