import { Request, Response } from "express";
import {
  ServiceService,
  ServiceServiceError,
} from "../../services/service.service";
import logger from "../../utils/logger";
import { ServiceRequestDTO } from "@yosemite-crew/types";
type BookableSlotsPayload = {
  serviceId: string;
  organisationId: string;
  date: string;
};
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { ParentModel } from "src/models/parent";
import helpers from "src/utils/helper";

const handleError = (error: unknown, res: Response, defaultMessage: string) => {
  if (error instanceof ServiceServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
};

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const ServiceController = {
  createService: async (
    req: Request<unknown, unknown, ServiceRequestDTO>,
    res: Response,
  ) => {
    try {
      const serviceRequest = req.body;
      const service = await ServiceService.create(serviceRequest);
      return res.status(201).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to create service.");
    }
  },

  updateService: async (
    req: Request<{ id: string }, unknown, ServiceRequestDTO>,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      const serviceRequest = req.body;
      const updated = await ServiceService.update(id, serviceRequest);
      return res.status(200).json(updated);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to update service.");
    }
  },

  deleteService: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      await ServiceService.delete(id);
      return res.status(204).send();
    } catch (error: unknown) {
      return handleError(error, res, "Unable to delete service.");
    }
  },

  getServiceById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;

      const service = await ServiceService.getById(id);

      if (!service) {
        return res.status(404).json({ message: "Service not found." });
      }

      return res.status(200).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch service.");
    }
  },

  listServicesBySpeciality: async (req: Request, res: Response) => {
    try {
      const { specialityId } = req.params;

      const services = await ServiceService.listBySpeciality(specialityId);

      return res.status(200).json(services);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch services by speciality.");
    }
  },

  listOrganisationByServiceName: async (req: Request, res: Response) => {
    try {
      const serviceName = req.query.serviceName as string;
      const latString = req.query.lat as string | undefined;
      const lngString = req.query.lng as string | undefined;

      if (!serviceName) {
        return res
          .status(400)
          .json({ message: "Query parameter serviceName is required." });
      }

      let lat: number | null = null;
      let lng: number | null = null;

      // --- 1. If lat/lng are provided by user, validate & use them ---
      if (latString && lngString) {
        lat = Number(latString);
        lng = Number(lngString);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return res
            .status(400)
            .json({ message: "lat and lng must be valid numbers" });
        }
      }

      // --- 2. Otherwise get location from authenticated user's address ---
      if (!lat || !lng) {
        const authUserId = resolveUserIdFromRequest(req);

        if (!authUserId) {
          return res
            .status(400)
            .json("Povide Latitude and Longitude if no authenticated request.");
        }

        const authUser =
          await AuthUserMobileService.getByProviderUserId(authUserId);

        const parent = await ParentModel.findById(authUser?.parentId);

        if (!parent?.address?.city || !parent?.address?.postalCode) {
          return res.status(400).json({
            message:
              "Location not provided and user has no saved city/pincode.",
          });
        }

        const query = `${parent.address.city} ${parent.address.postalCode}`;

        // 2a. Geocode city + pincode → lat/lng
        const geo = (await helpers.getGeoLocation(query)) as {
          lat: number;
          lng: number;
        };

        lat = geo.lat;
        lng = geo.lng;

        if (!lat || !lng) {
          return res.status(400).json({
            message: "Unable to resolve location from city and postal code.",
          });
        }
      }

      const results =
        await ServiceService.listOrganisationsProvidingServiceNearby(
          serviceName,
          lat,
          lng,
        );
      return res.status(200).json(results);
    } catch (error: unknown) {
      return handleError(
        error,
        res,
        "Unable to fetch organisations by service.",
      );
    }
  },

  getBookableSlotsForService: async (
    req: Request<unknown, unknown, BookableSlotsPayload>,
    res: Response,
  ) => {
    try {
      const { serviceId, organisationId, date } = req.body;

      if (!serviceId || !organisationId || !date) {
        return res.status(400).json({
          success: false,
          message: "serviceId, organisationId and date are required",
        });
      }

      const referenceDate = new Date(date);
      if (Number.isNaN(referenceDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format (use YYYY-MM-DD)",
        });
      }

      const result = await ServiceService.getBookableSlotsService(
        serviceId,
        organisationId,
        referenceDate,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch bookable slots");
    }
  },

  listByOrganisation: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const service = await ServiceService.listByOrganisation(organisationId);
      return res.status(200).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch service.");
    }
  },
};
