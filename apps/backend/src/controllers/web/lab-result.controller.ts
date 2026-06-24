import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  LabResultService,
  LabResultServiceError,
} from "src/services/lab-result.service";
import { IdexxResultsQueryService } from "src/services/idexx-results-query.service";
import { mapAxiosError } from "src/utils/external-error";
import { mergePdfBuffers } from "@yosemite-crew/lib";

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

const resolveOrganisationId = (req: Request) => {
  const orgReq = req as OrgRequest;
  return orgReq.organisationId ?? req.params.organisationId;
};

const ensureOrganisationId = (res: Response, organisationId?: string) => {
  if (!organisationId) {
    res.status(400).json({ message: "organisationId required." });
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

const handlePdfRequest = async (params: {
  req: Request;
  res: Response;
  fetchPayload: (resultId: string) => Promise<{
    data: ArrayBuffer;
    headers: Record<string, string>;
  } | null>;
}) => {
  const organisationId = resolveOrganisationId(params.req);
  const provider = params.req.params.provider;
  const resultId = params.req.params.resultId;
  if (!ensureOrganisationId(params.res, organisationId)) {
    return;
  }
  if (!ensureProviderAndResultId(params.res, provider, resultId)) {
    return;
  }
  if (!ensureIdexxProvider(params.res, provider)) {
    return;
  }

  const stored = await LabResultService.getByResultId(
    organisationId,
    provider,
    resultId,
  );
  if (!stored) {
    return params.res.status(404).json({ message: "Result not found." });
  }

  const payload = await params.fetchPayload(resultId);
  if (!payload) {
    return params.res.status(500).json({ message: "PDF unavailable." });
  }

  return sendPdfResponse(params.res, payload);
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

      const { orderId, patientId, limit } = req.query as Record<string, string>;

      const results = await LabResultService.list({
        organisationId,
        provider,
        orderId,
        patientId,
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
      const organisationId = resolveOrganisationId(req);
      const provider = req.params.provider;
      const resultId = req.params.resultId;

      if (!ensureOrganisationId(res, organisationId)) {
        return;
      }
      if (!ensureProviderAndResultId(res, provider, resultId)) {
        return;
      }

      const stored = await LabResultService.getByResultId(
        organisationId,
        provider,
        resultId,
      );
      if (stored) return res.status(200).json(stored);

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
      return await handlePdfRequest({
        req,
        res,
        fetchPayload: (resultId) =>
          IdexxResultsQueryService.getResultPdf(resultId),
      });
    } catch (error) {
      return handleIdexxError(
        res,
        error,
        "Failed to fetch result PDF",
        "Failed to fetch result PDF.",
      );
    }
  },

  async getCombinedPdf(req: Request, res: Response) {
    try {
      const organisationId = resolveOrganisationId(req);
      const provider = req.params.provider;
      if (!ensureOrganisationId(res, organisationId)) {
        return;
      }
      if (!provider) {
        return res.status(400).json({ message: "provider required." });
      }
      if (!ensureIdexxProvider(res, provider)) {
        return;
      }

      const resultIdsParam = req.query.resultIds;
      const resultIds = (
        typeof resultIdsParam === "string" ? resultIdsParam : ""
      )
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (!resultIds.length) {
        return res
          .status(400)
          .json({ message: "At least one resultId is required." });
      }

      const buffers: Buffer[] = [];
      for (const resultId of resultIds) {
        // Verify the result is stored for this organisation before fetching its
        // PDF from IDEXX — otherwise a user could pull PDFs for arbitrary result
        // ids belonging to other organisations.
        const stored = await LabResultService.getByResultId(
          organisationId,
          provider,
          resultId,
        );
        if (!stored) {
          return res
            .status(404)
            .json({ message: `Result not found for ${resultId}.` });
        }
        const payload = await IdexxResultsQueryService.getResultPdf(resultId);
        if (!payload) {
          return res
            .status(502)
            .json({ message: `Result PDF unavailable for ${resultId}.` });
        }
        buffers.push(Buffer.from(payload.data));
      }

      const merged = await mergePdfBuffers(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="lab-results-${resultIds.length}.pdf"`,
      );
      return res.status(200).send(merged);
    } catch (error) {
      return handleIdexxError(
        res,
        error,
        "Failed to build combined results PDF",
        "Failed to build combined results PDF.",
      );
    }
  },

  async getNotificationsPdf(req: Request, res: Response) {
    try {
      return await handlePdfRequest({
        req,
        res,
        fetchPayload: (resultId) =>
          IdexxResultsQueryService.getResultNotificationsPdf(resultId),
      });
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
      const organisationId = resolveOrganisationId(req);
      const provider = req.params.provider;
      const { orderId, patientId, limit } = req.query as Record<string, string>;
      if (!ensureOrganisationId(res, organisationId)) {
        return;
      }
      if (!provider) {
        return res.status(400).json({ message: "provider required." });
      }

      if (!ensureIdexxProvider(res, provider)) {
        return;
      }

      const results = await LabResultService.list({
        organisationId,
        provider,
        orderId,
        patientId,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(200).json(results);
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
