import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  LabResultService,
  LabResultServiceError,
} from "src/services/lab-result.service";
import { IdexxResultsQueryService } from "src/services/idexx-results-query.service";
import { mapAxiosError } from "src/utils/external-error";

const ensureProviderAndResultId = (
  res: Response,
  provider: string | undefined,
  resultId: string | undefined,
) => {
  if (!provider || !resultId) {
    res.status(400).json({ message: "provider and resultId required." });
    return false;
  }
  return true;
};

const ensureIdexxProvider = (res: Response, provider: string) => {
  if (provider.toUpperCase() !== "IDEXX") {
    res.status(400).json({ message: "Unsupported provider." });
    return false;
  }
  return true;
};

const sendPdfResponse = (
  res: Response,
  payload: { data: ArrayBuffer; headers: Record<string, string> },
) => {
  res.setHeader("Content-Type", "application/pdf");
  const disposition = payload.headers["content-disposition"];
  if (disposition) {
    res.setHeader("Content-Disposition", disposition);
  }
  return res.status(200).send(Buffer.from(payload.data));
};

const handleIdexxError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
) => {
  const axiosError = mapAxiosError(error, "IDEXX request failed");
  if (axiosError) {
    return res
      .status(axiosError.status)
      .json({ message: axiosError.message, details: axiosError.details });
  }
  logger.error(logMessage, error);
  return res.status(500).json({ message: responseMessage });
};

export const LabResultController = {
  async list(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;

      const { orderId, companionId, limit } = req.query as Record<
        string,
        string
      >;

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
      return handleIdexxError(
        res,
        error,
        "Failed to list lab results",
        "Failed to list lab results.",
      );
    }
  },

  async get(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;

      if (!ensureProviderAndResultId(res, provider, resultId)) {
        return;
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
      return handleIdexxError(
        res,
        error,
        "Failed to fetch lab result",
        "Failed to fetch lab result.",
      );
    }
  },

  async getPdf(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;
      if (!ensureProviderAndResultId(res, provider, resultId)) {
        return;
      }

      if (!ensureIdexxProvider(res, provider)) {
        return;
      }

      const payload = await IdexxResultsQueryService.getResultPdf(resultId);
      if (!payload)
        return res.status(500).json({ message: "PDF unavailable." });

      return sendPdfResponse(res, payload);
    } catch (error) {
      return handleIdexxError(
        res,
        error,
        "Failed to fetch result PDF",
        "Failed to fetch result PDF.",
      );
    }
  },

  async getNotificationsPdf(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      const resultId = req.params.resultId;
      if (!ensureProviderAndResultId(res, provider, resultId)) {
        return;
      }

      if (!ensureIdexxProvider(res, provider)) {
        return;
      }

      const payload =
        await IdexxResultsQueryService.getResultNotificationsPdf(resultId);
      if (!payload)
        return res.status(500).json({ message: "PDF unavailable." });

      return sendPdfResponse(res, payload);
    } catch (error) {
      return handleIdexxError(
        res,
        error,
        "Failed to fetch result notifications PDF",
        "Failed to fetch result notifications PDF.",
      );
    }
  },

  async search(req: Request, res: Response) {
    try {
      const provider = req.params.provider;
      if (!provider) {
        return res.status(400).json({ message: "provider required." });
      }

      if (!ensureIdexxProvider(res, provider)) {
        return;
      }

      const data = await IdexxResultsQueryService.search(
        req.query as Record<string, string>,
      );
      if (!data) {
        return res.status(500).json({ message: "Search unavailable." });
      }

      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        res,
        error,
        "Failed to search lab results",
        "Failed to search lab results.",
      );
    }
  },
};
