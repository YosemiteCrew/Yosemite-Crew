import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { MerckService } from "src/services/merck.service";
import {
  handleMerckError,
  sendMerckSuccess,
} from "src/controllers/merck/merck-response";

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

      return sendMerckSuccess(res, result, requestId);
    } catch (error) {
      return handleMerckError(
        res,
        error,
        requestId,
        "Merck mobile search failed",
      );
    }
  },
};
