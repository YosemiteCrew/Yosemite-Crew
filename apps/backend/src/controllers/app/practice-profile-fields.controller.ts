import type { Request, Response } from "express";
import { z } from "zod";
import type { OrgRequest } from "src/middlewares/rbac";
import { resolveVerifiedOrganisationId } from "src/utils/request";
import logger from "src/utils/logger";
import {
  PracticeProfileFieldsError,
  PracticeProfileFieldsService,
} from "src/services/practice-profile-fields.service";

const entityTypeSchema = z.enum(["CLIENT", "PATIENT"]);
const entityIdSchema = z.uuid();
const fieldIdSchema = z.uuid();
const fieldTypeSchema = z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);
const fieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  type: fieldTypeSchema,
  options: z.array(z.string().max(80)).max(50).default([]),
});
const valuesSchema = z.object({
  values: z
    .array(z.object({ fieldId: fieldIdSchema, value: z.unknown() }))
    .max(100),
});

const respondError = (error: unknown, res: Response, action: string) => {
  if (error instanceof PracticeProfileFieldsError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(action, { error });
  return res.status(500).json({ message: "Unable to update profile fields." });
};

const parseEntityType = (value: string): "CLIENT" | "PATIENT" | null => {
  const result = entityTypeSchema.safeParse(value.toUpperCase());
  return result.success ? result.data : null;
};

const getOrganisationId = (req: Request, res: Response) => {
  const request = req as OrgRequest;
  if (!request.userPermissions) {
    res.status(500).json({ message: "Organisation permissions are required." });
    return null;
  }
  return resolveVerifiedOrganisationId(req);
};

export const PracticeProfileFieldsController = {
  list: async (req: Request, res: Response) => {
    const organisationId = getOrganisationId(req, res);
    const entityType = parseEntityType(req.params.entityType);
    const entityId = entityIdSchema.safeParse(req.params.entityId);
    if (!organisationId || !entityType || !entityId.success) {
      if (!res.headersSent)
        res.status(400).json({ message: "Invalid profile request." });
      return;
    }
    try {
      const fields = await PracticeProfileFieldsService.list(
        entityType,
        entityId.data,
        organisationId,
      );
      return res.status(200).json(fields);
    } catch (error) {
      return respondError(error, res, "Failed to load practice profile fields");
    }
  },

  create: async (req: Request, res: Response) => {
    const organisationId = getOrganisationId(req, res);
    const entityType = parseEntityType(req.params.entityType);
    const parsed = fieldSchema.safeParse(req.body);
    if (!organisationId || !entityType || !parsed.success) {
      if (!res.headersSent)
        res.status(400).json({ message: "Invalid field definition." });
      return;
    }
    try {
      const field = await PracticeProfileFieldsService.create(
        entityType,
        organisationId,
        parsed.data,
      );
      return res.status(201).json(field);
    } catch (error) {
      return respondError(
        error,
        res,
        "Failed to create practice profile field",
      );
    }
  },

  deactivate: async (req: Request, res: Response) => {
    const organisationId = getOrganisationId(req, res);
    const fieldId = fieldIdSchema.safeParse(req.params.fieldId);
    if (!organisationId || !fieldId.success) {
      if (!res.headersSent)
        res.status(400).json({ message: "Invalid field identifier." });
      return;
    }
    try {
      await PracticeProfileFieldsService.deactivate(
        fieldId.data,
        organisationId,
      );
      return res.status(204).send();
    } catch (error) {
      return respondError(
        error,
        res,
        "Failed to deactivate practice profile field",
      );
    }
  },

  saveValues: async (req: Request, res: Response) => {
    const organisationId = getOrganisationId(req, res);
    const entityType = parseEntityType(req.params.entityType);
    const entityId = entityIdSchema.safeParse(req.params.entityId);
    const parsed = valuesSchema.safeParse(req.body);
    if (
      !organisationId ||
      !entityType ||
      !entityId.success ||
      !parsed.success
    ) {
      if (!res.headersSent)
        res.status(400).json({ message: "Invalid profile values." });
      return;
    }
    try {
      await PracticeProfileFieldsService.saveValues(
        entityType,
        entityId.data,
        organisationId,
        parsed.data.values,
      );
      return res.status(204).send();
    } catch (error) {
      return respondError(error, res, "Failed to save practice profile values");
    }
  },
};
