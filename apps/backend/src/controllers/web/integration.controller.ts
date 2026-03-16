import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  IntegrationService,
  IntegrationServiceError,
} from "src/services/integration.service";

const resolveOrganisationId = (req: Request): string | undefined => {
  const orgReq = req as OrgRequest;
  return orgReq.organisationId || req.params.organisationId;
};

export const IntegrationController = {
  listForOrganisation: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const list = await IntegrationService.listForOrganisation(organisationId);
      return res.status(200).json(list);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list integrations", error);
      return res
        .status(500)
        .json({ message: "Failed to list integrations." });
    }
  },

  getForOrganisation: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { provider } = req.params;
      const account = await IntegrationService.getForOrganisation(
        organisationId,
        provider,
      );

      if (!account) {
        return res.status(404).json({ message: "Integration not found." });
      }

      return res.status(200).json(account);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to fetch integration", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch integration." });
    }
  },

  updateCredentials: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { provider } = req.params;
      const { credentials, config } = req.body as Record<string, unknown>;

      const updated = await IntegrationService.upsertCredentials(
        organisationId,
        provider,
        (credentials ?? {}) as Record<string, unknown>,
        (config ?? undefined) as Record<string, unknown> | undefined,
      );

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to update integration credentials", error);
      return res.status(500).json({
        message: "Failed to update integration credentials.",
      });
    }
  },

  enable: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { provider } = req.params;
      const updated = await IntegrationService.setEnabled(
        organisationId,
        provider,
      );

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to enable integration", error);
      return res
        .status(500)
        .json({ message: "Failed to enable integration." });
    }
  },

  disable: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { provider } = req.params;
      const updated = await IntegrationService.setDisabled(
        organisationId,
        provider,
      );

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to disable integration", error);
      return res
        .status(500)
        .json({ message: "Failed to disable integration." });
    }
  },

  validate: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { provider } = req.params;
      const result = await IntegrationService.validateCredentials(
        organisationId,
        provider,
      );

      if (!result.ok) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof IntegrationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to validate integration", error);
      return res
        .status(500)
        .json({ message: "Failed to validate integration." });
    }
  },
};
