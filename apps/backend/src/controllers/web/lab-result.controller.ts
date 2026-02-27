import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import { LabResultService, LabResultServiceError } from "src/services/lab-result.service";
import { IdexxResultsQueryService } from "src/services/idexx-results-query.service";

export const LabResultController = {
  async list(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;

      const { orderId, companionId, limit } = req.query as Record<string, string>;

      const results = await LabResultService.list({
        organisationId,
        provider,
        orderId,
        companionId,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(200).json(results);
    } catch (error) {
      if (error instanceof LabResultServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list lab results", error);
      return res.status(500).json({ message: "Failed to list lab results." });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;

      if (!provider || !resultId) {
        return res.status(400).json({ message: "provider and resultId required." });
      }

      const stored = await LabResultService.getByResultId(provider, resultId);
      if (stored) return res.status(200).json(stored);

      if (provider.toUpperCase() === "IDEXX") {
        const remote = await IdexxResultsQueryService.getResult(resultId);
        if (!remote) {
          return res.status(404).json({ message: "Result not found." });
        }
        return res.status(200).json(remote);
      }

      return res.status(404).json({ message: "Result not found." });
    } catch (error) {
      logger.error("Failed to fetch lab result", error);
      return res.status(500).json({ message: "Failed to fetch lab result." });
    }
  },

  async getPdf(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;
      if (!provider || !resultId) {
        return res.status(400).json({ message: "provider and resultId required." });
      }

      if (provider.toUpperCase() !== "IDEXX") {
        return res.status(400).json({ message: "Unsupported provider." });
      }

      const payload = await IdexxResultsQueryService.getResultPdf(resultId);
      if (!payload) return res.status(500).json({ message: "PDF unavailable." });

      res.setHeader("Content-Type", "application/pdf");
      const disposition = payload.headers["content-disposition"];
      if (disposition) res.setHeader("Content-Disposition", disposition);
      return res.status(200).send(Buffer.from(payload.data));
    } catch (error) {
      logger.error("Failed to fetch result PDF", error);
      return res.status(500).json({ message: "Failed to fetch result PDF." });
    }
  },

  async getNotificationsPdf(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;
      if (!provider || !resultId) {
        return res.status(400).json({ message: "provider and resultId required." });
      }

      if (provider.toUpperCase() !== "IDEXX") {
        return res.status(400).json({ message: "Unsupported provider." });
      }

      const payload = await IdexxResultsQueryService.getResultNotificationsPdf(resultId);
      if (!payload) return res.status(500).json({ message: "PDF unavailable." });

      res.setHeader("Content-Type", "application/pdf");
      const disposition = payload.headers["content-disposition"];
      if (disposition) res.setHeader("Content-Disposition", disposition);
      return res.status(200).send(Buffer.from(payload.data));
    } catch (error) {
      logger.error("Failed to fetch result notifications PDF", error);
      return res.status(500).json({ message: "Failed to fetch result notifications PDF." });
    }
  },

  async search(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      if (!provider) {
        return res.status(400).json({ message: "provider required." });
      }

      if (provider.toUpperCase() !== "IDEXX") {
        return res.status(400).json({ message: "Unsupported provider." });
      }

      const data = await IdexxResultsQueryService.search(req.query as Record<string, string>);
      if (!data) {
        return res.status(500).json({ message: "Search unavailable." });
      }

      return res.status(200).json(data);
    } catch (error) {
      logger.error("Failed to search lab results", error);
      return res.status(500).json({ message: "Failed to search lab results." });
    }
  },
};
