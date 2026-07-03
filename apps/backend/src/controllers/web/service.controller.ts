import { Request, Response } from "express";
import { z } from "zod";
import {
  ServiceService,
  ServiceServiceError,
} from "../../services/service.service";
import {
  CatalogService,
  CatalogServiceError,
} from "../../services/catalog.service";
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
  if (
    error instanceof ServiceServiceError ||
    error instanceof CatalogServiceError
  ) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
};

const parseCoordinates = (
  latString: string | undefined,
  lngString: string | undefined,
) => {
  if (!latString || !lngString) {
    return { lat: null, lng: null };
  }

  const lat = Number(latString);
  const lng = Number(lngString);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { lat: null, lng: null };
  }

  return { lat, lng };
};

const resolveCoordinatesFromSavedAddress = async (authUserId: string) => {
  const parentAddress = await getParentAddressForAuthUser(authUserId);

  if (!parentAddress?.city || !parentAddress?.postalCode) {
    return { lat: null, lng: null, reason: "missing-address" as const };
  }

  const locationQuery = `${parentAddress.city} ${parentAddress.postalCode}`;
  const geo = await helpers.getGeoLocation(locationQuery);

  const geoRecord =
    geo && typeof geo === "object" ? (geo as Record<string, unknown>) : {};
  const lat = typeof geoRecord.lat === "number" ? geoRecord.lat : null;
  const lng = typeof geoRecord.lng === "number" ? geoRecord.lng : null;

  return {
    lat,
    lng,
    locationQuery,
    reason:
      lat === null || lng === null
        ? ("unresolved" as const)
        : ("resolved" as const),
  };
};

type ServiceSearchContext = {
  lat: number | null;
  lng: number | null;
  locationQuery: string | undefined;
  error:
    | "invalid-coordinates"
    | "missing-auth"
    | "missing-address"
    | "unresolved"
    | null;
};

const resolveServiceSearchContext = async (
  req: Request,
): Promise<ServiceSearchContext> => {
  const latString = req.query.lat as string | undefined;
  const lngString = req.query.lng as string | undefined;
  const query = req.query.query as string | undefined;
  const hasCoordinateParams =
    latString !== undefined || lngString !== undefined;
  const { lat: requestedLat, lng: requestedLng } = parseCoordinates(
    latString,
    lngString,
  );

  if (hasCoordinateParams && (requestedLat == null || requestedLng == null)) {
    return {
      lat: null,
      lng: null,
      locationQuery: query,
      error: "invalid-coordinates",
    };
  }

  if (requestedLat != null && requestedLng != null) {
    return {
      lat: requestedLat,
      lng: requestedLng,
      locationQuery: query,
      error: null,
    };
  }

  const authUserId = resolveUserIdFromRequest(req);
  if (!authUserId) {
    return {
      lat: null,
      lng: null,
      locationQuery: query,
      error: "missing-auth",
    };
  }

  const resolved = await resolveCoordinatesFromSavedAddress(authUserId);
  if (resolved.lat == null || resolved.lng == null) {
    return {
      lat: null,
      lng: null,
      locationQuery: resolved.locationQuery,
      error:
        resolved.reason === "missing-address"
          ? "missing-address"
          : "unresolved",
    };
  }

  return {
    lat: resolved.lat,
    lng: resolved.lng,
    locationQuery: resolved.locationQuery,
    error: null,
  };
};

const HealthcareServiceSchema = z
  .object({
    resourceType: z.literal("HealthcareService"),
  })
  .passthrough();

const HealthcareServiceListSchema = z.array(HealthcareServiceSchema).min(1);

export const ServiceController = {
  createService: async (
    req: Request<unknown, unknown, ServiceRequestDTO>,
    res: Response,
  ) => {
    try {
      const parsed = HealthcareServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR HealthcareService resource.",
        });
      }

      const serviceRequest = parsed.data;
      const service = await ServiceService.create(serviceRequest);
      return res.status(201).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to create service.");
    }
  },

  createMany: async (req: Request, res: Response) => {
    try {
      const parsed = HealthcareServiceListSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Invalid payload list. Expected array of FHIR HealthcareService resources.",
        });
      }

      const services = await ServiceService.createMany(parsed.data);
      return res.status(201).json(services);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to create services.");
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

      if (!serviceName) {
        return res
          .status(400)
          .json({ message: "Query parameter serviceName is required." });
      }

      const locationContext = await resolveServiceSearchContext(req);
      if (locationContext.error === "missing-auth") {
        return res
          .status(400)
          .json("Povide Latitude and Longitude if no authenticated request.");
      }

      if (locationContext.error) {
        const message =
          locationContext.error === "invalid-coordinates"
            ? "lat and lng must be valid numbers"
            : locationContext.error === "missing-address"
              ? "Location not provided and user has no saved city/pincode."
              : "Unable to resolve location from city and postal code.";
        return res.status(400).json({ message });
      }

      const { lat, lng, locationQuery } = locationContext;
      if (lat == null || lng == null) {
        return res.status(400).json({
          message: "Unable to resolve location from city and postal code.",
        });
      }

      const results =
        await ServiceService.listOrganisationsProvidingServiceNearby(
          serviceName,
          lat,
          lng,
          locationQuery,
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

      const result = await CatalogService.getBookableSlotsService(
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

      const matches = await CatalogService.getCalendarPrefillMatches({
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
