import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  resolveVerifiedOrganisationId,
  resolveVerifiedUserId,
} from "src/utils/request";
import { FormServiceError } from "src/services/form.service";
import { FormDraftImportService } from "src/services/formDraftImport.service";

const CreateDraftImportSchema = z.object({
  suppliedText: z.string().trim().min(1).max(20_000),
  sourceFormId: z.uuid().optional(),
});

const resolveAuthorizedOrgId = (req: Request, res: Response): string | null => {
  const organisationId = resolveVerifiedOrganisationId(req);
  if (!organisationId) {
    res.status(400).json({ message: "Organisation could not be resolved" });
    return null;
  }
  return organisationId;
};

const handleError = (context: string, error: unknown, res: Response) => {
  if (error instanceof FormServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(context, error);
  return res.status(500).json({ message: "Something went wrong" });
};

export const FormDraftImportController = {
  create: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const userId = resolveVerifiedUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const parsed = CreateDraftImportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      const data = await FormDraftImportService.create({
        organisationId,
        userId,
        suppliedText: parsed.data.suppliedText,
        sourceFormId: parsed.data.sourceFormId,
      });

      return res.status(201).json({ data });
    } catch (error: unknown) {
      return handleError("createFormDraftImport error", error, res);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const data = await FormDraftImportService.get(
        organisationId,
        req.params.id,
      );
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("getFormDraftImport error", error, res);
    }
  },

  discard: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      await FormDraftImportService.discard(organisationId, req.params.id);
      return res.status(204).send();
    } catch (error: unknown) {
      return handleError("discardFormDraftImport error", error, res);
    }
  },
};
