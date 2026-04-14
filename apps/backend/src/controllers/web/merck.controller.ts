import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { OrgRequest } from "src/middlewares/rbac";
import { MerckService } from "src/services/merck.service";
import {
  handleMerckError,
  sendMerckSuccess,
} from "src/controllers/merck/merck-response";
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
      const safeOrganisationId =
        typeof organisationId === "string" && organisationId.trim()
          ? organisationId
          : null;
      if (!safeOrganisationId) {
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

      const userId =
        typeof orgReq.userId === "string" && orgReq.userId.trim()
          ? orgReq.userId
          : null;
      let resolvedTimezone = timezone;
      if (!resolvedTimezone && userId) {
        const profile = isReadFromPostgres()
          ? await prisma.userProfile.findFirst({
              where: { userId, organizationId: safeOrganisationId },
              select: { personalDetails: true },
            })
          : await UserProfileModel.findOne({
              userId,
              organizationId: safeOrganisationId,
            })
              .setOptions({ sanitizeFilter: true })
              .select({ "personalDetails.timezone": 1 })
              .lean();
        const personalDetails = profile?.personalDetails as
          | { timezone?: string }
          | null
          | undefined;
        resolvedTimezone = personalDetails?.timezone;
      }

      const result = await MerckService.search({
        organisationId: safeOrganisationId,
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

      return sendMerckSuccess(res, result, requestId);
    } catch (error) {
      return handleMerckError(res, error, requestId, "Merck search failed");
    }
  },
};
