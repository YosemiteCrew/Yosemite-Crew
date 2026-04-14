import { Request, Response } from "express";
import { z } from "zod";
import {
  ServiceService,
  ServiceServiceError,
} from "../../services/service.service";
import logger from "../../utils/logger";
import { ServiceRequestDTO } from "@yosemite-crew/types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
type BookableSlotsPayload = {
  serviceId: string;
  organisationId: string;
  date: string;
};
type CalendarPrefillPayload = {
  organisationId: string;
  date: string;
  minuteOfDay: number;
  leadId?: string;
  serviceIds: string[];
};
import helpers from "src/utils/helper";
import { resolveUserIdFromRequest } from "src/utils/request";
import { getParentAddressForAuthUser } from "src/utils/location";

dayjs.extend(utc);

const BookableSlotsPayloadSchema = z.object({
  serviceId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1),
  date: z
    .string()
    .trim()
    .refine(
      (value) => dayjs.utc(value, "YYYY-MM-DD", true).isValid(),
      "Invalid date format (use YYYY-MM-DD)",
    ),
});

const CalendarPrefillPayloadSchema = z.object({
  organisationId: z.string().trim().min(1),
  date: z
    .string()
    .trim()
    .refine(
      (value) => dayjs.utc(value, "YYYY-MM-DD", true).isValid(),
      "Invalid date format (use YYYY-MM-DD)",
    ),
  minuteOfDay: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
  leadId: z.string().trim().min(1).optional(),
  serviceIds: z.array(z.string().trim().min(1)).min(1),
});

const handleError = (error: unknown, res: Response, defaultMessage: string) => {
  if (error instanceof ServiceServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
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

        const parentAddress = await getParentAddressForAuthUser(authUserId);

        if (!parentAddress?.city || !parentAddress?.postalCode) {
          return res.status(400).json({
            message:
              "Location not provided and user has no saved city/pincode.",
          });
        }

        const query = `${parentAddress.city} ${parentAddress.postalCode}`;

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
      const payloadResult = BookableSlotsPayloadSchema.safeParse(req.body);
      if (!payloadResult.success) {
        const body =
          req.body && typeof req.body === "object" ? req.body : undefined;
        const hasMissingRequiredField =
          !body ||
          !("serviceId" in body) ||
          !("organisationId" in body) ||
          !("date" in body);

        return res.status(400).json({
          success: false,
          message: hasMissingRequiredField
            ? "serviceId, organisationId and date are required"
            : payloadResult.error.issues[0]?.message ||
              "serviceId, organisationId and date are required",
        });
      }

      const { serviceId, organisationId, date } = payloadResult.data;
      const referenceDate = dayjs.utc(date, "YYYY-MM-DD", true).toDate();

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

  getCalendarPrefill: async (
    req: Request<unknown, unknown, CalendarPrefillPayload>,
    res: Response,
  ) => {
    try {
      const payloadResult = CalendarPrefillPayloadSchema.safeParse(req.body);
      if (!payloadResult.success) {
        return res.status(400).json({
          success: false,
          message:
            payloadResult.error.issues[0]?.message ??
            "Invalid calendar prefill payload",
        });
      }

      const { organisationId, date, minuteOfDay, leadId, serviceIds } =
        payloadResult.data;

      const matches = await ServiceService.getCalendarPrefillMatches({
        organisationId,
        date: dayjs.utc(date, "YYYY-MM-DD", true).toDate(),
        minuteOfDay,
        leadId,
        serviceIds,
      });

      return res.status(200).json({
        success: true,
        data: { matches },
      });
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch calendar prefill");
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
