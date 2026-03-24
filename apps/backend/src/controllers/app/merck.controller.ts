import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { MerckService, MerckServiceError } from "src/services/merck.service";
import { mapAxiosError } from "src/utils/external-error";
import logger from "src/utils/logger";

export const MerckMobileController = {
  async searchManuals(req: Request, res: Response) {
    const requestId = randomUUID();
    try {
      const query = req.query as Record<string, string | undefined>;
      const {
        q,
        language,
        media,
        code,
        codeSystem,
        displayName,
        originalText,
        subTopicCode,
        subTopicDisplay,
        timezone,
      } = query;

      const result = await MerckService.searchConsumer({
        query: q ?? "",
        audience: "PAT",
        language: language as "en" | "es" | undefined,
        media: media as "hybrid" | "print" | "full" | undefined,
        timezone,
        code,
        codeSystem,
        displayName,
        originalText,
        subTopicCode,
        subTopicDisplay,
        requestId,
      });

      return res.status(200).json({
        ...result,
        meta: {
          ...result.meta,
          requestId,
        },
      });
    } catch (error) {
      const axiosError = mapAxiosError(error, "Merck request failed");
      if (axiosError) {
        return res.status(axiosError.status).json({
          message: axiosError.message,
          code: "MERCK_SEARCH_FAILED",
          requestId,
        });
      }
      if (error instanceof MerckServiceError) {
        return res.status(error.statusCode).json({
          message: error.message,
          code: "MERCK_SEARCH_FAILED",
          requestId,
        });
      }
      logger.error("Merck mobile search failed", error);
      return res.status(500).json({
        message: "Merck search failed.",
        code: "MERCK_SEARCH_FAILED",
        requestId,
      });
    }
  },
};
