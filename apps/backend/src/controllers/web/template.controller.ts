import { Request, Response } from "express";
import type { OrgRequest } from "src/middlewares/rbac";
import { ParamsDictionary } from "express-serve-static-core";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  createTemplateInstanceSchema,
  createTemplateSchema,
  TemplateService,
  TemplateServiceError,
  resolveTemplateSchema,
  updateTemplateCatalogLinksSchema,
  updateTemplateInstanceSchema,
  updateTemplateSchema,
} from "src/services/template.service";
import { z } from "zod";
import { TemplateKind, TemplateScope, TemplateStatus } from "@prisma/client";

const templateKindQuerySchema = z.union([
  z.enum(TemplateKind),
  z.enum([
    "SOAP_NOTE",
    "VITAL_RECORD",
    "DISCHARGE_SUMMARY",
    "PRESCRIPTION",
    "FORM",
    "CONSENT",
    "INPATIENT_SCHEDULE",
    "TASK_ASSIGNMENT",
  ]),
]);

// Which library kinds each view permission covers. Clinical document templates
// travel with forms; scheduling templates travel with tasks.
const FORM_TEMPLATE_KINDS = [
  "FORM",
  "SOAP_NOTE",
  "VITAL_RECORD",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "INVOICE",
] as const;
const TASK_TEMPLATE_KINDS = ["TASK_TEMPLATE", "CARE_PATHWAY"] as const;

const listQuerySchema = z.object({
  kind: templateKindQuerySchema.optional(),
  status: z.enum(TemplateStatus).optional(),
  scope: z.enum(TemplateScope).optional(),
  search: z.string().trim().optional(),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TemplateServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid template payload.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

export const TemplateController = {
  async resolve(req: Request, res: Response) {
    try {
      const resolvedUserId = resolveUserId(req);
      const body = resolveTemplateSchema.parse({
        ...req.query,
        ownerUserId:
          (req.query.ownerUserId as string | undefined) ??
          (resolvedUserId || undefined),
      });
      const template = await TemplateService.resolve(body);
      return res.json(template);
    } catch (error) {
      return handleError(error, res);
    }
  },

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

  /**
   * The shared template library, narrowed to the kinds the caller may see.
   *
   * The route admits `forms:view:any` OR `tasks:view:any` because the library
   * holds both, and `requirePermission` treats an array as any-of - so a
   * task-only role could read every FORM template in it (and vice versa). The
   * permission the caller actually holds decides which kinds come back, and a
   * caller asking for a kind they may not see gets an empty list rather than an
   * error, because the mixed listing legitimately returns nothing for them.
   */
  async listLibrary(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const permissions = (req as OrgRequest).userPermissions ?? [];
      const allowedKinds = [
        ...(permissions.includes("forms:view:any") ? FORM_TEMPLATE_KINDS : []),
        ...(permissions.includes("tasks:view:any") ? TASK_TEMPLATE_KINDS : []),
      ];

      if (allowedKinds.length === 0) {
        return res.json([]);
      }

      const templates = await TemplateService.listLibrary({
        ...query,
        allowedKinds,
      });
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
        organisationId: req.params.organisationId,
        authorId: resolveUserId(req) || undefined,
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
