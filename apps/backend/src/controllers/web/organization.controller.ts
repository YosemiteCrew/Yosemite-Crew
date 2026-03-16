import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  OrganisationSearchInput,
  OrganizationService,
  OrganizationServiceError,
  type OrganizationFHIRPayload,
} from "../../services/organization.service";
import { generatePresignedUrl } from "src/middlewares/upload";
import { stringify } from "node:querystring";
import helpers from "src/utils/helper";
import { resolveUserIdFromRequest } from "src/utils/request";
import { getParentAddressForAuthUser } from "src/utils/location";

const isOrganizationPayload = (
  payload: unknown,
): payload is OrganizationFHIRPayload =>
  Boolean(
    payload &&
    typeof payload === "object" &&
    (payload as { resourceType?: string }).resourceType === "Organization",
  );

const requireBusinessId = (req: Request, res: Response): string | null => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "Business ID is required." });
    return null;
  }
  return id;
};

const handleOrganizationError = (
  error: unknown,
  res: Response,
  logMessage: string,
  responseMessage: string,
) => {
  if (error instanceof OrganizationServiceError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  logger.error(logMessage, error);
  res.status(500).json({ message: responseMessage });
};

const respondWithPresignedUpload = async (
  res: Response,
  mimeType: string,
  orgId: Record<string, string>,
) => {
  const { url, key } = orgId
    ? await generatePresignedUrl(mimeType, "org", stringify(orgId))
    : await generatePresignedUrl(mimeType, "temp");
  res.status(200).json({ uploadUrl: url, s3Key: key });
};

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
      handleOrganizationError(
        error,
        res,
        "Failed to onboard business",
        "Unable to onboard business.",
      );
    }
  },

  getBusinessById: async (req: Request, res: Response) => {
    try {
      const id = requireBusinessId(req, res);
      if (!id) return;

      const resource = await OrganizationService.getById(id);

      if (!resource) {
        res.status(404).json({ message: "Business not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      handleOrganizationError(
        error,
        res,
        "Failed to retrieve business",
        "Unable to retrieve business.",
      );
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
      const id = requireBusinessId(req, res);
      if (!id) return;

      const deleted = await OrganizationService.deleteById(id);

      if (!deleted) {
        res.status(404).json({ message: "Business not found." });
        return;
      }

      res.status(200).json({ message: "Business deleted successfully." });
    } catch (error) {
      handleOrganizationError(
        error,
        res,
        "Failed to delete business",
        "Unable to delete business.",
      );
    }
  },

  updateBusinessById: async (req: Request, res: Response) => {
    try {
      const id = requireBusinessId(req, res);
      if (!id) return;
      const rawPayload: unknown = req.body;

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
      handleOrganizationError(
        error,
        res,
        "Failed to update business",
        "Unable to update business.",
      );
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
      await respondWithPresignedUpload(res, mimeType, orgId);
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
      handleOrganizationError(
        error,
        res,
        "Failed to search business",
        "Unable to search business.",
      );
    }
  },

  getNearbyPaginated: async (req: Request, res: Response) => {
    try {
      const latString = req.query.lat as string | undefined;
      const lngString = req.query.lng as string | undefined;
      const radius = req.query.radius ? Number(req.query.radius) : 5000;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      let lat: number | null = null;
      let lng: number | null = null;

      // --- 1. Use user-provided lat/lng if available ---
      if (latString && lngString) {
        lat = Number(latString);
        lng = Number(lngString);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return res.status(400).json({
            message: "lat & lng must be valid numbers",
          });
        }
      }

      // --- 2. Fallback: use user's saved city+pincode ---
      if (!lat || !lng) {
        const authUserId = resolveUserIdFromRequest(req);
        const parentAddress = await getParentAddressForAuthUser(authUserId);

        if (!parentAddress?.city || !parentAddress?.postalCode) {
          return res.status(400).json({
            message: "Location missing and user has no saved city/pincode.",
          });
        }

        const query = `${parentAddress.city} ${parentAddress.postalCode}`;

        // Geocode city+pincode → lat/lng
        const geo = (await helpers.getGeoLocation(query)) as {
          lat: number;
          lng: number;
        };

        lat = geo.lat;
        lng = geo.lng;

        if (!lat || !lng) {
          return res.status(400).json({
            message: "Unable to resolve location from user's saved address.",
          });
        }
      }

      // --- 3. Now fetch nearby organisations ---
      const result =
        await OrganizationService.listNearbyForAppointmentsPaginated(
          lat,
          lng,
          radius,
          page,
          limit,
        );

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Server error";
      logger.error("Error while fetching nearby organisations: ", error);
      res.status(500).json({ message });
    }
  },
};
