import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  CompanionService,
  CompanionServiceError,
} from "../../services/companion.service";
import type { CompanionRequestDTO } from "@yosemite-crew/types";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { Types } from "mongoose";
import { generatePresignedUrl } from "src/middlewares/upload";
import { CompanionOrganisationService } from "src/services/companion-organisation.service";
import OrganizationModel from "src/models/organization";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

type CompanionRequestBody =
  | CompanionRequestDTO
  | { payload?: unknown }
  | undefined;

// Validate FHIR
const isCompanionPayload = (
  payload: unknown,
): payload is CompanionRequestDTO => {
  return (
    !!payload &&
    typeof payload === "object" &&
    "resourceType" in payload &&
    (payload as { resourceType?: unknown }).resourceType === "Patient"
  );
};

// Resolve User ID
const resolveMobileUserId = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") return headerUserId;

  return authReq.userId;
};

// extract FHIR
const extractFHIRPayload = (req: Request): CompanionRequestDTO => {
  const body = req.body as CompanionRequestBody;

  if (!body) {
    throw new CompanionServiceError("Request body is required.", 400);
  }

  const payload =
    typeof body === "object" && "payload" in body
      ? (body.payload ?? body)
      : body;

  if (!isCompanionPayload(payload)) {
    throw new CompanionServiceError("Invalid FHIR Patient payload.", 400);
  }

  return payload;
};

const requireParam = (
  res: Response,
  value: string | undefined,
  message: string,
): value is string => {
  if (!value) {
    res.status(400).json({ message });
    return false;
  }
  return true;
};

const handleCompanionError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
) => {
  if (error instanceof CompanionServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logMessage, error);
  return res.status(500).json({ message: responseMessage });
};

export const CompanionController = {
  createCompanionMobile: async (req: Request, res: Response) => {
    try {
      const payload = extractFHIRPayload(req);

      const authUserId = resolveMobileUserId(req);
      if (!authUserId) {
        return res.status(401).json({
          message: "Authentication required for mobile companion creation.",
        });
      }

      const { response } = await CompanionService.create(payload, {
        authUserId,
      });

      return res.status(201).json(response);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to create companion (mobile)",
        "Unable to create companion.",
      );
    }
  },

  createCompanionPMS: async (req: Request, res: Response) => {
    try {
      const payload = extractFHIRPayload(req);

      const { parentId } = (req.body ?? {}) as { parentId?: string };
      const orgId = (req.params as { orgId?: string } | undefined)?.orgId;

      if (!parentId || !Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({
          message:
            "Valid parentId is required to create companion through PMS.",
        });
      }

      const { response } = await CompanionService.create(payload, {
        parentMongoId: new Types.ObjectId(parentId),
      });

      // Establish link between PMS and Companion
      if (orgId) {
        if (!isReadFromPostgres() && !Types.ObjectId.isValid(orgId)) {
          return res.status(400).json({
            message: "Valid organisationId is required to create companion.",
          });
        }

        const authUser = resolveMobileUserId(req);
        if (!authUser) {
          return res.status(401).json({
            message:
              "Authentication required to link companion with organisation.",
          });
        }

        const organisation = isReadFromPostgres()
          ? await prisma.organization.findFirst({ where: { id: orgId } })
          : await OrganizationModel.findById(orgId);
        if (!organisation) {
          return res
            .status(404)
            .json({ message: "Organisation not found for provided orgId." });
        }

        await CompanionOrganisationService.linkByPmsUser({
          pmsUserId: authUser,
          organisationId: orgId,
          organisationType: organisation.type,
          companionId: response.id!,
        });
      }

      return res.status(201).json(response);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to create companion (PMS)",
        "Unable to create companion.",
      );
    }
  },

  getCompanionById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!requireParam(res, id, "Companion ID is required.")) {
        return;
      }

      const result = await CompanionService.getById(id);
      if (!result) {
        return res.status(404).json({ message: "Companion not found." });
      }

      return res.status(200).json(result.response);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to fetch companion",
        "Unable to fetch companion.",
      );
    }
  },

  updateCompanion: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!requireParam(res, id, "Companion ID is required.")) {
        return;
      }

      const payload = extractFHIRPayload(req);
      const result = await CompanionService.update(id, payload);

      if (!result) {
        return res.status(404).json({ message: "Companion not found." });
      }

      return res.status(200).json(result.response);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to update companion",
        "Unable to update companion.",
      );
    }
  },

  deleteCompanion: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authUserId = resolveMobileUserId(req);
      if (!requireParam(res, id, "Companion ID is required.")) {
        return;
      }

      await CompanionService.delete(id, {
        authUserId,
      });
      return res.status(204).send();
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to delete companion",
        "Unable to delete companion.",
      );
    }
  },

  searchCompanionByName: async (req: Request, res: Response) => {
    try {
      const { name } = req.query;

      if (!name || typeof name !== "string") {
        return res
          .status(400)
          .json({ message: "A valid search name is required." });
      }

      const result = await CompanionService.getByName(name);

      return res.status(200).json(result.responses);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to search companion by name",
        "Unable to search companions.",
      );
    }
  },

  getProfileUploadUrl: async (req: Request, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      const mimeType =
        typeof rawBody === "object" && rawBody !== null && "mimeType" in rawBody
          ? (rawBody as { mimeType?: unknown }).mimeType
          : undefined;

      if (typeof mimeType !== "string" || !mimeType) {
        res
          .status(400)
          .json({ message: "MIME type is required in the request body." });
        return;
      }

      const { url, key } = await generatePresignedUrl(mimeType, "temp");

      return res.status(200).json({ url, key });
    } catch (error) {
      logger.error("Failed to generate pre-signed URL", error);
      return res
        .status(500)
        .json({ message: "Failed to generate upload URL." });
    }
  },

  getCompanionsByParentId: async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;

      if (!requireParam(res, parentId, "Companion ID is required.")) {
        return;
      }

      const result = await CompanionService.listByParent(parentId);

      return res.status(200).json(result.responses);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to search companion by Parent ID",
        "Unable to search companions.",
      );
    }
  },

  listParentCompanionsNotInOrganisation: async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { parentId, organisationId } = req.params;

      if (!parentId || !organisationId) {
        return res
          .status(400)
          .json({ message: "Companion ID and Organisation ID is required." });
      }

      const result = await CompanionService.listByParentNotInOrganisation(
        parentId,
        organisationId,
      );

      return res.status(200).json(result.responses);
    } catch (error) {
      return handleCompanionError(
        res,
        error,
        "Failed to search companion by Parent ID",
        "Unable to search companions.",
      );
    }
  },
};
