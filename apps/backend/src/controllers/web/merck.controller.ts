import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import { MerckService, MerckServiceError } from "src/services/merck.service";
import { mapAxiosError } from "src/utils/external-error";
import UserProfileModel from "src/models/user-profile";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

export const MerckController = {
  async searchManuals(req: Request, res: Response) {
    const requestId = randomUUID();
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({
          message: "organisationId is required.",
          code: "MERCK_SEARCH_FAILED",
          requestId,
        });
      }

      const query = req.query as Record<string, string | undefined>;
      const {
        q,
        audience,
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

      const userId = orgReq.userId;
      let resolvedTimezone = timezone;
      if (!resolvedTimezone && userId) {
        const profile = isReadFromPostgres()
          ? await prisma.userProfile.findFirst({
              where: { userId, organizationId: organisationId },
              select: { personalDetails: true },
            })
          : await UserProfileModel.findOne({
              userId,
              organizationId: organisationId,
            })
              .select({ "personalDetails.timezone": 1 })
              .lean();
        const personalDetails = profile?.personalDetails as
          | { timezone?: string }
          | null
          | undefined;
        resolvedTimezone = personalDetails?.timezone;
      }

      const result = await MerckService.search({
        organisationId,
        query: q ?? "",
        audience: audience as "PROV" | "PAT" | undefined,
        language: language as "en" | "es" | undefined,
        media: media as "hybrid" | "print" | "full" | undefined,
        timezone: resolvedTimezone,
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
      logger.error("Merck search failed", error);
      return res.status(500).json({
        message: "Merck search failed.",
        code: "MERCK_SEARCH_FAILED",
        requestId,
      });
    }
  },
};
