import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  OrganisationSearchInput,
  OrganizationService,
  OrganizationServiceError,
  type OrganizationFHIRPayload,
} from "../../services/organization.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { generatePresignedUrl } from "src/middlewares/upload";
import { stringify } from "querystring";

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

const isOrganizationPayload = (
  payload: unknown,
): payload is OrganizationFHIRPayload =>
  Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { resourceType?: string }).resourceType === "Organization",
  );

export const OrganizationController = {
  onboardBusiness: async (req: Request, res: Response) => {
    try {
      const rawPayload: unknown = req.body;

      if (!isOrganizationPayload(rawPayload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const payload = rawPayload;
      const userId = resolveUserIdFromRequest(req);

      const { response, created } = await OrganizationService.upsert(
        payload,
        userId,
      );

      res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof OrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to onboard business", error);
      res.status(500).json({ message: "Unable to onboard business." });
    }
  },

  getBusinessById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Business ID is required." });
        return;
      }

      const resource = await OrganizationService.getById(id);

      if (!resource) {
        res.status(404).json({ message: "Business not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof OrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to retrieve business", error);
      res.status(500).json({ message: "Unable to retrieve business." });
    }
  },

  getAllBusinesses: async (_req: Request, res: Response) => {
    try {
      const resources = await OrganizationService.listAll();
      res.status(200).json(resources);
    } catch (error) {
      logger.error("Failed to retrieve businesses", error);
      res.status(500).json({ message: "Unable to retrieve businesses." });
    }
  },

  deleteBusinessById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Business ID is required." });
        return;
      }

      const deleted = await OrganizationService.deleteById(id);

      if (!deleted) {
        res.status(404).json({ message: "Business not found." });
        return;
      }

      res.status(200).json({ message: "Business deleted successfully." });
    } catch (error) {
      if (error instanceof OrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to delete business", error);
      res.status(500).json({ message: "Unable to delete business." });
    }
  },

  updateBusinessById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rawPayload: unknown = req.body;

      if (!id) {
        res.status(400).json({ message: "Business ID is required." });
        return;
      }
      if (!isOrganizationPayload(rawPayload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const payload = rawPayload;
      const resource = await OrganizationService.update(id, payload);

      if (!resource) {
        res.status(404).json({ message: "Business not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof OrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to update business", error);
      res.status(500).json({ message: "Unable to update business." });
    }
  },

  getLogoUploadUrl: async (req: Request, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      const orgId = req.params;
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
      if (orgId) {
        logger.info("");
        const { url, key } = await generatePresignedUrl(
          mimeType,
          "org",
          stringify(orgId),
        );
        res.status(200).json({ uploadUrl: url, s3Key: key });
      } else {
        const { url, key } = await generatePresignedUrl(mimeType, "temp");
        res.status(200).json({ uploadUrl: url, s3Key: key });
      }
    } catch (error) {
      logger.error("Failed to generate logo upload URL", error);
      res.status(500).json({ message: "Unable to generate logo upload URL." });
    }
  },

  checkIsPMSOrganistaion: async (req: Request, res: Response) => {
    try {
      const body = req.body as OrganisationSearchInput;
      const result = await OrganizationService.resolveOrganisation(body);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof OrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to search business", error);
      res.status(500).json({ message: "Unable to search business." });
    }
  },

  async getNearbyPaginated(req: Request, res: Response) {
    try {
      const { lat, lng, radius, page = 1, limit = 10 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ message: "lat & lng required" });
      }

      const result = await OrganizationService.listNearbyForAppointmentsPaginated(
        Number(lat),
        Number(lng),
        radius ? Number(radius) : 5000,
        Number(page),
        Number(limit),
      );

      res.json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Server error";
      res.status(500).json({ message });
    }
  },
};
